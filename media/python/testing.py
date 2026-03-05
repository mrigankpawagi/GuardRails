from typing import List, Any, Tuple, Callable
import concurrent.futures

class Testing:
    """
    Class for running fuzz tests and pairwise-equivalence tests on the given function samples.
    """
    
    def __init__(self, function_samples: List[Callable], test_inputs: List[Tuple[Any]], timeout: int = 5):
        """
        Initialize the Testing object.
        
        :param function_samples: List of function samples.
        :param test_inputs: List of test inputs.
        :param timeout: The timeout for each test case in seconds (default is 5).
        """
        self.function_samples = function_samples
        self.test_inputs = test_inputs
        self.test_outputs = {}

        with concurrent.futures.ThreadPoolExecutor() as executor:
            for i, function_sample in enumerate(self.function_samples):
                self.test_outputs[i] = {}
                for j, test_input in enumerate(self.test_inputs):
                    try:
                        future = executor.submit(function_sample, *test_input)
                        output = future.result(timeout=timeout)
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
        for i in range(len(self.function_samples)):
            for j in range(i + 1, len(self.function_samples)):
                for k in range(len(self.test_inputs)):
                    if self.test_outputs[i][k] != self.test_outputs[j][k]:
                        differences.append((i, j, self.test_inputs[k]))
        return differences

    def __fuzz_tests(self) -> List[Tuple[int, Any]]:
        """
        Return test cases that fail for one or more code samples.
        """
        failures = []
        for i in range(len(self.function_samples)):
            for j in range(len(self.test_inputs)):
                if self.test_outputs[i][j]["status"] == "error":
                    failures.append((i, self.test_inputs[j]))
        return failures
