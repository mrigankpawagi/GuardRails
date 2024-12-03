from flask import render_template, request
from app import app
from app.generate import CodeGemini, TestGemini

GENERATION_BUDGET = 10


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/submit', methods=['GET'])
def submit():
    definition = request.args.get('definition')

    # generate code samples
    code_samples = []
    for i in range(GENERATION_BUDGET):
        code_samples.append(CodeGemini.generate(definition))

    # generate test inputs
    test_inputs = TestGemini.generate(definition)
        
    pass
