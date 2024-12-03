from flask import render_template, request
from app import app

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/submit', methods=['GET'])
def submit():
    definition = request.args.get('definition')
    declaration = request.args.get('declaration')
    pass
