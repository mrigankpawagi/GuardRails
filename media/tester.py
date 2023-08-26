import re
import ast
from hypothesis import given, strategies as st, settings
from hypothesis.extra import ghostwriter
import os
import doctest
import io
import copy
import json
import sys
from func_timeout import func_set_timeout, FunctionTimedOut

context = None
output_log = dict()
output_log['reports'] = []

DEBUG = False

def _print(*args, **kwargs):
    if DEBUG:
        print(*args, **kwargs)


def fix_suggestion(suggestion: str) -> str:
    global context

    # Remove the first two lines
    suggestion = suggestion.split('\n', 2)[2]

    # Remove the part followed by ``` if any
    suggestion = suggestion.split('```')[0]

    # Check if suggestion already contains the context
    # Check with all whitespace removed
    if re.sub(r'\s', '', context) not in re.sub(r'\s', '', suggestion):
        
        # Remove new lines from beginning of suggestion
        suggestion = suggestion.lstrip('\n')

        # Get the whitespace in beginning of suggestion
        whitespace = re.match(r'\s*', suggestion).group(0)

        # Get indentation in context
        # Get the line with triple quotes
        context_whitespace = None
        context_lines = context.split('\n')
        for line in context_lines:
            if '"""' in line or "'''" in line:
                context_whitespace = re.match(r'\s*', line).group(0)
                break
        
        if context_whitespace is None:
            context_whitespace = "    "
        
        if whitespace != context_whitespace:
            # Replace indentation of the first line in suggestion
            suggestion = context_whitespace + suggestion.lstrip()

        # Add context to suggestion
        suggestion = context + '\n' + suggestion

    return suggestion


def print_doctest(fault, code = None, mut = False):
    
    args = repr(fault)
    if isinstance(fault, tuple):
        args = args[1:-1]

        #remove trailing comma (if any)
        if args[-1] == ',':
            args = args[:-1]

    _print(f"    >>> {function_name}({args})", end='\t')
    if code:
        _print(f"[{code}]", end='')
    if mut:
        _print(f" [mut]", end='')
    _print()

    return f"{function_name}({args})"


def run_doctest_silently(func):
    # Create a StringIO object to capture the output
    output = io.StringIO()

    dt = doctest.DocTestParser()
    test = dt.get_doctest(func.__doc__, globals(), None, None, None)

    # Run the test
    runner = doctest.DocTestRunner(verbose=False)

    # Capture the output
    runner.run(test, out=output.write)

    # Return the output
    return output.getvalue()


def remove_docstring(s: str):
    # Check whether docstring has """ or '''

    # get string after header, strip it and check first three characters
    quotes = s.split(")", 1)[1].split(":", 1)[1].strip()[:3]

    # remove docstring
    if quotes == '"""':
        s = re.sub(r'"""(.|\n)*"""', '', s)
    elif quotes == "'''":
        s = re.sub(r"'''(.|\n)*'''", '', s)

    return s

# Read context
with open('context.txt', 'r') as f:
    context = f.read()

# Read suggestions dump
with open('suggestions.txt', 'r') as f:
    suggestions = f.read()

# Read mutation config
with open('mutate.txt', 'r') as f:
    mutation_config = int(f.read())
    output_log['mutation_config'] = mutation_config

suggestion_pool = []

suggestions_list = [fix_suggestion(s) for s in suggestions.split('\n=======\n')[1:]]

# check if context has no docstring
if context.strip() == remove_docstring(context).strip():

    # add an empty docstring
    context = context.strip() + '\n    """\n    """'

# Check if all suggestions have docstrings
temp_suggestions_list = []
for s in suggestions_list:

    # remove function header
    header = s[:s.find(":", s.find(")")) + 1]
    body = s.split(")", 1)[1].split(":", 1)[1]

    # get position of first non-whitespace character
    pos = re.search(r'\S', body).start()

    # get indent
    indent = body[:pos] 

    # check if body has no docstring
    if body.strip()[:3] not in ('"""', "'''"):
        
        # add an empty docstring
        body = indent + '"""\n' + indent + '"""\n' + body

    temp_suggestions_list.append(header + "\n" + body)

suggestions_list = temp_suggestions_list

num_total_suggestions = len(suggestions_list)

# Remove malformed suggestions (syntax errors)
syntactic_suggestions = []

for suggestion in suggestions_list:
    try:
        ast.parse(suggestion)
        syntactic_suggestions.append(suggestion)
    except:
        pass

num_syntactic_suggestions = len(syntactic_suggestions)

_print(f"Syntactically correct suggestions: {num_syntactic_suggestions}/{num_total_suggestions}")
output_log['total_suggestions'] = num_total_suggestions
output_log['syntactic_suggestions'] = num_syntactic_suggestions

suggestion_pool.extend([{ 'suggestion': s, 'mutant': False } for s in syntactic_suggestions])

if num_syntactic_suggestions == 0:
    exit(0)

if mutation_config == 1:
    mutations = []
    # Create mutations of syntactically correct suggestions

    # create a blank test file
    with open('test.py', 'w') as f:
        f.write('')

    for suggestion in syntactic_suggestions:
        # Write suggestion to a temporary file
        with open('temp.py', 'w') as f:
            f.write(suggestion)

        # Mutate temp.py using mutpy
        # run `mutpy --target temp.py --unit-test test.py -m`

        pipe = os.popen('mutpy --target temp.py --unit-test test.py -m')
        stdout = pipe.read()
        pipe.close()
        
        mutations.extend(stdout.split("-" * 80)[1::2])
    
    # remove temp.py and test.py
    os.remove('temp.py')
    os.remove('test.py')

    _print(f"Total mutations generated: {len(mutations)}")
    output_log['mutant_count'] = num_total_suggestions

    # # Replace single-triple quotes with double-triple quotes in docstrings
    # for mutant in mutations:
    #     # replace first two occurances only
    #     mutant = mutant.replace("'''", '"""', 2)
    
    suggestion_pool.extend([{ 'suggestion': m, 'mutant': True } for m in mutations])


# Generate strategy for testing
blank_suggestion = fix_suggestion('\n\npass')
function_name = re.match(r'def\s+(\w+)\s*\(', blank_suggestion).group(1)
exec(remove_docstring(blank_suggestion))
func = globals()[function_name]

ghostwriter_output = ghostwriter.fuzz(func)

# Extract the @given decorator
given_decorator = ghostwriter_output[ghostwriter_output.find('@given'):ghostwriter_output.find('def') - 1]

GENERATE_ONLY_ASCII = True

if GENERATE_ONLY_ASCII:
    given_decorator = given_decorator.replace("st.text()", "st.text(alphabet=st.characters(min_codepoint=32, max_codepoint=126))")

# Extract the arguments from blank_suggestion
args = re.match(r'def\s+\w+\s*\((.*)\)', blank_suggestion).group(1)

# Remove any parts of the pattern [...]
args = re.sub(r'\[.*?\]', '', args)

# split args by comma
args_list = args.split(',')

# ignore the part after '=' or ':' and strip whitespace. Then join back with comma
args = ','.join([arg.split('=')[0].split(':')[0].strip() for arg in args_list])

FAULTS = []

# Perform fuzzing and self-equivalence testing on all suggestions
fuzz_faults = []
_print("\nStarting fuzzing and self-equivalence testing...")
fuzz_survivors = []
test = object()

for suggestion in suggestion_pool:    
    s = remove_docstring(suggestion['suggestion'])
    try:
        exec(f"""
@func_set_timeout(0.3)
{s}\n

f = None

@settings(print_blob=False, verbosity=0)
{given_decorator}
def test({args}):
    global f
    f = ({args},)
    f_0 = copy.deepcopy(f)
    assert {function_name}(*f) == {function_name}(*f_0)""")

        test()
        fuzz_survivors.append(suggestion)
    except AssertionError:
        suggestion['catch'] = 'selfeq'
        suggestion['fault'] = f
    except FunctionTimedOut:
        suggestion['catch'] = 'timeout'
        suggestion['fault'] = f
    except:
        suggestion['catch'] = 'fuzz'
        suggestion['fault'] = f

for suggestion in suggestion_pool:
    if 'catch' in suggestion and suggestion['catch'] in ('timeout', 'fuzz', 'selfeq'):
        if suggestion['fault'] not in fuzz_faults:
            fuzz_faults.append(suggestion['fault'])
            print_doctest(suggestion['fault'], suggestion['catch'], suggestion['mutant'])
            output_log['reports'].append({
                'fault': print_doctest(suggestion['fault']),
                'catch': suggestion['catch'],
                'mutant': suggestion['mutant']
            })

FAULTS.extend(fuzz_faults)

_print(f"\nSurviving suggestions: {len(fuzz_survivors)}/{len(suggestion_pool)}")
output_log['fuzz_survivors'] = len(fuzz_survivors)
_print(f"Fuzzed suggestions retained for doctesting.")

# Check if context contains any doctests if terminate if there are no doctests

# extract docstring

# Check whether docstring has """ or '''
# get string after header, strip it and check first three characters
quotes = context.split(")", 1)[1].split(":", 1)[1].strip()[:3]

# remove docstring
if quotes == '"""':
    docstring = re.search(r'"""(.*)"""', context, re.DOTALL).group(1)
elif quotes == "'''":
    docstring = re.search(r"'''(.*)'''", context, re.DOTALL).group(1)

# check if docstring contains any doctests
if '>>>' not in docstring:
    _print("No doctests were found.")
    # exit(0)

# Perform doctests on all suggestions (previously: only fuzz survivors)
doctest_survivors = []
_print("\nStarting doctesting...")

for suggestion in suggestion_pool:  # previously: for suggestion in fuzz_survivors:
    s = suggestion['suggestion']
    
    try:
        exec("@func_set_timeout(0.3)\n" + s)
        output = run_doctest_silently(globals()[function_name]).strip()
        if output == '':
            doctest_survivors.append(suggestion)
        else:
            suggestion['catch'] = 'doctest'
    except:
        suggestion['catch'] = 'doctest'

_print(f"\nSurviving suggestions: {len(doctest_survivors)}/{len(suggestion_pool)}")  # previously: {len(doctest_survivors)}/{len(fuzz_survivors)}")
output_log['doctest_survivors'] = doctest_survivors

# Perform pair-wise equivalence testing on surviving suggestions
pairwise_faults = []
equivalents = []
differences = []
_print("\nStarting pair-wise equivalence testing...")

for i in range(len(doctest_survivors)):
    for j in range(i + 1, len(doctest_survivors)):
        s1 = doctest_survivors[i]['suggestion']
        s2 = doctest_survivors[j]['suggestion']

        # change function name in s1 and s2 (func -> func1 and func2)
        s1 = re.sub(r'def\s+(\w+)\s*\(', r'def \1_1(', s1)
        s2 = re.sub(r'def\s+(\w+)\s*\(', r'def \1_2(', s2)

        exec(f"""

@func_set_timeout(0.3)
{remove_docstring(s1)}\n

@func_set_timeout(0.3)
{remove_docstring(s2)}\n

f = None

@settings(print_blob=False, verbosity=0)
{given_decorator}
def test({args}):
    global f
    f = ({args},)
    f_0 = copy.deepcopy(f)
    assert {function_name}_1(*f) == {function_name}_2(*f_0)""")
        
        try:
            test()
            equivalents.append((i, j))
        except:
            if f not in pairwise_faults:
                pairwise_faults.append(f)
                differences.append((i, j, f))
                print_doctest(f, 'pairwise', doctest_survivors[i]['mutant'] or doctest_survivors[j]['mutant'])
                output_log['reports'].append({
                    'fault': print_doctest(f),
                    'catch': 'pairwise',
                    'mutant': doctest_survivors[i]['mutant'] or doctest_survivors[j]['mutant']
                })


FAULTS.extend([f for f in pairwise_faults if f not in FAULTS])

# Create equivalence classes and difference classes
equivalence_classes = {}
counter = 0

for i, j in equivalents:
    if i not in equivalence_classes:
        equivalence_classes[i] = counter
        counter += 1
    equivalence_classes[j] = equivalence_classes[i]

# collect remaining classes
for i in range(len(doctest_survivors)):
    if i not in equivalence_classes:
        equivalence_classes[i] = counter
        counter += 1

difference_classes = {}

for i, j, f in differences:
    cls1 = equivalence_classes[i]
    cls2 = equivalence_classes[j]
    if cls1 > cls2:
        cls1, cls2 = cls2, cls1
    if (cls1, cls2) not in difference_classes:
        difference_classes[(cls1, cls2)] = []
    difference_classes[(cls1, cls2)].append(f)

_print()
_print("=" * 80)
_print("All Doctest Suggestions: ")
for f in FAULTS:
    print_doctest(f)

# Print two simplest suggestions from each difference class
_print()
_print("=" * 80)
_print("Simplest differentiating doctest suggestions: ")
for diff_class in difference_classes.values():
    simplest_diff = sorted(diff_class, key=lambda x: len(str(x)))[:2]
    for f in simplest_diff:
        print_doctest(f)

_print()
_print("=" * 80)
_print("All Valid Suggestions:\n\n")
for s in doctest_survivors:
    _print(s['suggestion'])
    _print("-" * 80)

output_log['FAULTS'] = [print_doctest(x) for x in FAULTS]
output_log['equivalence_classes'] = {str(k): v for k, v in equivalence_classes.items()}
output_log['difference_classes'] = {f"{k[0]}, {k[1]}": [print_doctest(x) for x in v] for k, v in difference_classes.items()}

if not DEBUG:
    print(json.dumps(output_log))
