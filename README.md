# GuardRails
VSCode extension to help developers set up guardrails around their functions, by helping them disambiguate purpose statements.

- Our paper was presented at the 6th Annual COMPUTE Conference by ACM India. Check it out [here](https://arxiv.org/abs/2312.08189).
- The VSCode extension is available on the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=MrigankPawagi.guardrails).
- A dataset on the performance of GuardRails in comparison with Copilot Chat is available [here](https://docs.google.com/spreadsheets/d/e/2PACX-1vRwmXlP8V6gbXtB1oQ5IUXfbRjW3eoCYKcbm-zN4uXphd_AK4Wj0CZzVmeXW4XvF2_scszdCD89CFpV/pubhtml?gid=0&single=true).

> [!WARNING]  
> Due to recent updates in the Copilot's VSCode extension, functionality critical for GuardRails is no longer supported. Please hang on while we update GuardRails.   

![Demo](https://raw.githubusercontent.com/mrigankpawagi/GuardRails/master/media/demo.gif)

## Requirements

1. Python

__Note:__
GuardRails is fully tested only on Windows and currently provides experimental support for Linux.

### Installing Python Dependencies

```bash
$ python -m pip install hypothesis hypothesis[cli] hypothesis[ghostwriter] black
$ python -m pip install git+https://github.com/mrigankpawagi/mutpy.git#egg=mutpy
$ python -m pip install func-timeout
```
