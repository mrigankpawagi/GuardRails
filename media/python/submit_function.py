import os
import sys
import json
import time
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content
from mutate import TypedMutGen
from testing import Testing

# genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
genai.configure(api_key="AIzaSyCL0khrsyNRrBgY08aeOdNwUfnqJt7HnOc")

# Number of contracts to generate
CONTRACT_POOL_SIZE = 10

# Number of inputs to generate per contract
TEST_POOL_SIZE = 1000

generation_config_contract = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_schema": content.Schema(
        type = content.Type.OBJECT,
        enum = [],
        required = ["completion"],
        properties = {
            "completion": content.Schema(
                type = content.Type.STRING,
            ),
        },
    ),
    "response_mime_type": "application/json",
}
model_contract = genai.GenerativeModel(
    model_name = "gemini-1.5-flash-8b",
    generation_config = generation_config_contract,
    system_instruction = "You are a professional Python programmer. Given an incomplete Python function definition, you produce a function called `input_contract` that has the same signature as the function. The `input_contract` function returns True if the inputs are valid according to the type hints and other constraints described in the docstring of the function, and False otherwise. Include detailed validation for each parameter. If the specification is ambiguous, you can make reasonable assumptions. Your output is always syntactically correct and complete code. Wrap the code in ```python and ```.",
)


def make_contract_prompt(data):
    return f"""Create an `input_contract` function for the function `{data['functionName']}` given below.\n\n```python\n{data['imports']}\n{data['declaration']}\n``` Please complete the following definition.\n\n```python\ndef input_contract({data['arguments']}) -> bool:\n    pass\n```"""


def generate_input_contract(function_data):
    chat_session = model_contract.start_chat(history=[])
    response = chat_session.send_message(make_contract_prompt(function_data))
    completion = json.loads(response.text)["completion"]
    completion = completion.split("```python", 1)[1].split("```")[0]

    return completion


generation_config_tests = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_schema": content.Schema(
        type = content.Type.OBJECT,
        enum = [],
        required = ["inputs"],
        properties = {
            "inputs": content.Schema(
                    type = content.Type.ARRAY,
                    items = content.Schema(
                    type = content.Type.STRING,
                ),
            ),
        },
    ),
    "response_mime_type": "application/json",
}
model_tests = genai.GenerativeModel(
    model_name = "gemini-1.5-flash-8b",
    generation_config = generation_config_tests,
    system_instruction = "You are a professional Python programmer. Given an incomplete Python function definition, you produce complex, difficult, and corner-case inputs to test the function. You provide the string representation of inputs as Python objects and pack arguments inside tuples. For example, if the function is `def add(a: int, b: int) -> int:`, you output `(1, 2)`, `(3, 4)`, etc.",
)


def make_test_prompt(data):
    return f"""{data['imports']}\n{data['declaration']}"""


def generate_test_case(function_data):
    chat_session = model_tests.start_chat(history=[])
    response = chat_session.send_message(make_test_prompt(function_data))
    inputs = json.loads(response.text)["inputs"]
    inputs_as_objects = []
    for inp in inputs:
        try:
            inputs_as_object = eval(inp)
            if not isinstance(inputs_as_object, tuple):
                inputs_as_object = (inputs_as_object,)
            inputs_as_objects.append(inputs_as_object)
        except Exception:
            continue
    
    return inputs_as_objects


def process_function(data):
    # Generate test cases for the function
    try:
        test_cases = generate_test_case(data)
    except Exception:
        exit(1)

    # Generate input contracts for the function
    input_contracts = []
    for _ in range(CONTRACT_POOL_SIZE):
        try:
            contract_code = generate_input_contract(data)
        except Exception:
            continue
        
        # get the contract function
        env = {}
        exec(data['imports'], env)
        exec(contract_code, env)
        contract_function = env['input_contract']

        # Generate inputs from the contract function
        input_generator = TypedMutGen(test_cases, contract_function)
        new_inputs = input_generator.generate(TEST_POOL_SIZE)
        
        input_contracts.append({
            "contract_code": contract_code,
            "contract_function": contract_function,
            "inputs": test_cases + new_inputs
        })

        time.sleep(1) # sleep to avoid rate limiting

    # Run tests on the contract functions
    testing = Testing(
        [contract['contract_function'] for contract in input_contracts],
        sum([contract['inputs'] for contract in input_contracts], []),
    )

    print(testing.suggestions_pairwise)
    print(testing.suggestions_fuzz)


if __name__ == "__main__":
    # input_data = sys.stdin.read()
    # result = process_function(json.loads(input_data))
    result = process_function({
        "functionName": "operator",
        "imports": "",
        "declaration": '''def operator(num1: int, num2: int, result: int) -> str:
    """Return the operator among //, *, +, -
    for which num1 operator num2 == result."""''',
        "arguments": "num1: int, num2: int, result: int",
    })
    # print(json.dumps(result))
