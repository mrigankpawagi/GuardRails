# VSPrutor

## Requirements

1. Python

2. GCC

__Note:__
VSPrutor is currently supported only on Windows.

## Features

1. Alternate Prutor frontend, from within VSCode.

2. Logging pedagogically important data from students

3. CoPilot suggestion trimmer (for Python)
    - `Control + Shift + P` after opening suggestions panel (`Control + Enter`)
    - Suggests a differentiating doctest if there are multiple valid suggestions and if the function arguments have type hinting.

## Set Up

### Step 1
Set `vsprutor.server`, `vsprutor.username` and `vsprutor.password` in _User Settings_. Note that this is not required for using the suggestion trimmer.