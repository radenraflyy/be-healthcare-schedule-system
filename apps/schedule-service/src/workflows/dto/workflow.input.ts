export interface WorkflowStepInput {
  title?: string;
  description?: string;
}

export interface SaveWorkflowInput {
  steps?: WorkflowStepInput[];
}
