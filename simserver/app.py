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
                    "labid": 1,
                    "testcases": [
                        {
                            "id": 1,
                            "input": "3\n4\n5",
                            "correctOutput": "4\n5\n6",
                            "output": "",
                            "status": ""
                        },
                        {
                            "id": 1,
                            "input": "6\n7\n8",
                            "correctOutput": "7\n8\n9",
                            "output": "",
                            "status": ""
                        },
                        {
                            "id": 1,
                            "input": "1\n2\n3",
                            "correctOutput": "Faulty Case",
                            "output": "",
                            "status": ""
                        }
                    ]
                },
                {
                    "id": 2,
                    "name": "Problem 2",
                    "description": "This is problem 2",
                    "labid": 1,
                    "testcases": [
                        {
                            "id": 1,
                            "input": "3\n4\n5",
                            "correctOutput": "4\n5\n6",
                            "output": "",
                            "status": ""
                        },
                        {
                            "id": 1,
                            "input": "6\n7\n8",
                            "correctOutput": "7\n8\n9",
                            "output": "",
                            "status": ""
                        },
                        {
                            "id": 1,
                            "input": "1\n2\n3",
                            "correctOutput": "Faulty Case",
                            "output": "",
                            "status": ""
                        }
                    ]
                },
                {
                    "id": 3,
                    "name": "Problem 3",
                    "description": "This is problem 3",
                    "labid": 1,
                    "testcases": [
                        {
                            "id": 1,
                            "input": "3\n4\n5",
                            "correctOutput": "4\n5\n6",
                            "output": "",
                            "status": ""
                        },
                        {
                            "id": 1,
                            "input": "6\n7\n8",
                            "correctOutput": "7\n8\n9",
                            "output": "",
                            "status": ""
                        },
                        {
                            "id": 1,
                            "input": "1\n2\n3",
                            "correctOutput": "Faulty Case",
                            "output": "",
                            "status": ""
                        }
                    ]
                }
            ]
        }
    ]
    return jsonify({"labs": labs})