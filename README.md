# VSPrutor

## Requirements

1. Python

2. GCC

__Note:__
VSPrutor is currently supported only on Windows.

### Installing Python Dependencies for trimming and mutations

    python -m pip install hypothesis hypothesis[cli] hypothesis[ghostwriter] black
    python -m pip install git+https://github.com/mrigankpawagi/mutpy.git#egg=mutpy

## Features

1. Alternate Prutor frontend, from within VSCode.

2. Logging pedagogically important data from students

3. Copilot suggestion trimmer (for Python)
    - `Control + Shift + /` after opening suggestions panel (`Control + Enter`)
    - Suggests a differentiating doctest if there are multiple valid suggestions and if the function arguments have type hinting.

4. Copilot suggestion mutator-trimmer (for Python)
    - `Control + Shift + ;` after opening suggestions panel (`Control + Enter`)
    - Suggests a differentiating doctest if there are multiple valid suggestions or mutants and if the function arguments have type hinting.


## Set Up

### Step 1
Set `vsprutor.server`, `vsprutor.username` and `vsprutor.password` in _User Settings_. Note that this is not required for using the suggestion trimmer or mutator-trimmer.