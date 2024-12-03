from flask import render_template, request
from app import app
from generate import CodeGemini

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/submit', methods=['GET'])
def submit():
    pass
