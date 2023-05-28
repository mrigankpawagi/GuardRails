export interface Problem{
    id: number;
    name: string;
    description: string;
    labid: number;
    testcases: Array<Testcase>;
    environment: string | undefined;
    current: boolean;
}

export interface Lab{
    id: number;
    name: string;
    problems: Array<Problem>;
}

export interface Testcase{
    id: number;
    input: string;
    correctOutput: string;
    output: string;
    status: string;
};