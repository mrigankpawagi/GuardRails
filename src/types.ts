export interface Problem{
    id: number;
    name: string;
    description: string;
    labid: number;
}

export interface Lab{
    id: number;
    name: string;
    problems: Array<Problem>;
}