from typing import List, Any, Tuple
from pyjail import Jail


class Testing:
    """
    Class for running fuzz tests and pairwise-equivalence tests on the code samples.
    """
    
    def __init__(self, code_samples: List[str], test_inputs: List[Tuple[Any]], entry_point: str, timeout: int = 10):
        """
        Initialize the Testing object.
        
        :param code_samples: List of code samples.
        :param test_inputs: List of test inputs.
        :param entry_point: The entry point of the code samples.
        :param timeout: The timeout for each test case in seconds (default is 10).
        """
        self.code_samples = code_samples
        self.test_inputs = test_inputs
        self.test_outputs = {}

        # generate test outputs
        def exec_sample(code: str, args: Tuple[Any], entry_point: str) -> Any:
            """
            Execute a code sample with the given arguments.
            
            :param code: The code sample.
            :param args: The arguments to pass to the code
            :param entry_point: The entry point of the code sample.
            :return: The output of the code sample.
            """
            exec(code)
            return locals()[entry_point](*args)

        with Jail() as jail:
            for i, code_sample in enumerate(self.code_samples):
                self.test_outputs[i] = {}
                for j, test_input in enumerate(self.test_inputs):
                    try:
                        output = jail.execute(exec_sample, [code_sample, test_input, entry_point], {}, timeout=timeout)
                        self.test_outputs[i][j] = {
                            "status": "executed",
                            "result": output
                        }
                    except Exception as e:
                        self.test_outputs[i][j] = {
                            "status": "error",
                            "result": e.__class__.__name__
                        }

        self.suggestions_pairwise = self.__pairwise_equivalence()
        self.suggestions_fuzz = self.__fuzz_tests()

    def __pairwise_equivalence(self) -> List[Tuple[int, int, Any]]:
        """
        Return test cases that differentiate between pairs of code samples.
        """
        differences = []
        for i in range(len(self.code_samples)):
            for j in range(i + 1, len(self.code_samples)):
                for k in range(len(self.test_inputs)):
                    if self.test_outputs[i][k] != self.test_outputs[j][k]:
                        differences.append((i, j, self.test_inputs[k]))
        return differences

    def __fuzz_tests(self) -> List[Tuple[int, Any]]:
        """
        Return test cases that fail for one or more code samples.
        """
        failures = []
        for i in range(len(self.code_samples)):
            for j in range(len(self.test_inputs)):
                if self.test_outputs[i][j]["status"] == "error":
                    failures.append((i, self.test_inputs[j]))
        return failures
