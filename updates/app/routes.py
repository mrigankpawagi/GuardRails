from flask import render_template, request
import json
import time
from app import app
from app.generate import CodeGemini, TestGemini
from app.testing import Testing
from app.mutate import TypedMutGen

GENERATION_BUDGET = 10
MUTATION_BUDGET = 200


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/submit', methods=['GET'])
def submit():
    declaration = request.args.get('declaration')
    
    # extract the entry point from the declaration
    entry_point = declaration.split('def ')[-1].split('(')[0]

    # generate code samples
    code_samples = []
    for _ in range(GENERATION_BUDGET):
        try:
            completion = CodeGemini.generate(declaration)
            if completion is not None:
                code_samples.append(completion)
        except Exception as e:
            pass
        
        # sleep for a short duration to avoid rate limiting
        time.sleep(0.5)

    # generate test inputs
    test_inputs = TestGemini.generate(declaration)

    mutated_inputs = TypedMutGen(test_inputs).generate(MUTATION_BUDGET)
    test_inputs.extend(mutated_inputs)

    testing = Testing(code_samples, test_inputs, entry_point)

    return json.dumps({
        "fuzz_suggestions": testing.suggestions_fuzz,
        "pairwise_suggestions": testing.suggestions_pairwise,
    })
