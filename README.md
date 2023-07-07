# GuardRails

## Requirements

1. Python

__Note:__
VSPrutor is currently supported only on Windows and with Python.

### Installing Python Dependencies for trimming and mutations

    python -m pip install hypothesis hypothesis[cli] hypothesis[ghostwriter] black
    python -m pip install git+https://github.com/mrigankpawagi/mutpy.git#egg=mutpy

## Features

1. Copilot suggestion trimmer (for Python)
    - `Control + Shift + /` after opening suggestions panel (`Control + Enter`)
    - Suggests a differentiating doctest if there are multiple valid suggestions and if the function arguments have type hinting.

2. Copilot suggestion mutator-trimmer (for Python)
    - `Control + Shift + ;` after opening suggestions panel (`Control + Enter`)
    - Suggests a differentiating doctest if there are multiple valid suggestions or mutants and if the function arguments have type hinting.
