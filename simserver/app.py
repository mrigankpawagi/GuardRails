from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return ""

@app.route("/get_labs", methods=["POST"])
def get_labs():
    labs = [
        {
            "id": 1,
            "name": "Lab 1",
            "problems": [
                {
                    "id": 1,
                    "name": "Problem 1",
                    "description": "This is problem 1",
                    "labid": 1
                },
                {
                    "id": 2,
                    "name": "Problem 2",
                    "description": "This is problem 2",
                    "labid": 1
                },
                {
                    "id": 3,
                    "name": "Problem 3",
                    "description": "This is problem 3",
                    "labid": 1
                }
            ]
        }
    ]
    return jsonify({"labs": labs})