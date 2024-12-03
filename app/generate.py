import os
import json
from abc import abstractmethod
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GENAI_API_KEY"))


class CodeModel:
    @staticmethod
    @abstractmethod
    def generate(self, prompt: str) -> str:
        pass


class TestModel:
    @staticmethod
    @abstractmethod
    def generate(self, prompt: str) -> list:
        pass


class CodeGemini(CodeModel):
    generation_config = {
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
    model = genai.GenerativeModel(
        model_name = "gemini-1.5-pro",
        generation_config = generation_config,
        system_instruction = "You are a professional Python programmer. Given an incomplete Python function definition, you produce the function body. If the specification is ambiguous, you can make reasonable assumptions. Your output is always a syntactically correct and complete function including the function header. Wrap the code in ```python and ```.",
    )

    @staticmethod
    def generate(prompt: str) -> str:
        chat_session = CodeGemini.model.start_chat(history=[])
        response = chat_session.send_message(prompt)
        completion = json.loads(response.text)["completion"]
        completion = completion.split("```python", 1)[1].split("```")[0]
        
        return completion


class TestGemini(TestModel):
    generation_config = {
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
    model = genai.GenerativeModel(
        model_name = "gemini-1.5-pro",
        generation_config = generation_config,
        system_instruction = "You are a professional Python programmer. Given an incomplete Python function definition, you produce complex, difficult, and corner-case inputs to test the function. You provide the string representation of inputs as Python objects and pack arguments inside tuples.",
    )

    @staticmethod
    def generate(prompt: str) -> list:
        chat_session = TestGemini.model.start_chat(history=[])
        response = chat_session.send_message(prompt)
        inputs = json.loads(response.text)["inputs"]
        inputs_as_objects = [eval(input) for input in inputs]
        
        return inputs_as_objects
