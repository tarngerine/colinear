import {
  Attachment,
  Favorite,
  Issue,
  LinearClient,
  Project,
  ProjectMilestone,
  User,
  WorkflowState,
} from "@linear/sdk";

/**
 * Wrapper class for the Linear GraphQL API with queries and types we need
 */
export class Linear {
  constructor(private linear: LinearClient) {}

  async viewer() {
    return this.linear.viewer;
  }

  async myIssues() {
    const result = await this.linear.client.rawRequest<MyIssuesResponse, {}>(
      myIssuesQuery
    );
    return result.data?.viewer.assignedIssues.nodes;
  }

  async branchIssue(branch: string) {
    const result = await this.linear.client.rawRequest<
      BranchIssueResponse,
      { branch: string }
    >(branchIssueQuery, { branch });
    return result.data?.issueVcsBranchSearch;
  }

  async favorites() {
    const result = await this.linear.client.rawRequest<FavoritesResponse, {}>(
      favoritesQuery
    );
    return result.data?.favorites.nodes.sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
  }

  async project(id: string) {
    const result = await this.linear.client.rawRequest<
      { project: ProjectPartial },
      { id: string }
    >(
      `query Project($id: String!) {
      project(id: $id) {
        ${projectQueryFragment}
      }
    }`,
      { id }
    );
    return result.data?.project;
  }

  async milestone(id: string) {
    const result = await this.linear.client.rawRequest<
      { projectMilestone: ProjectMilestonePartial },
      { id: string }
    >(
      `query Milestone($id: String!) {
      projectMilestone(id: $id) {
        ${projectMilestoneQueryFragment}
      }
    }`,
      { id }
    );
    return result.data?.projectMilestone;
  }

  async noMilestoneIssues(projectId: string) {
    const result = await this.linear.client.rawRequest<
      { issues: { nodes: IssuePartial[] } },
      { id: string }
    >(noMilestoneQuery, { id: projectId });
    return result.data?.issues.nodes;
  }
}

export type IssuePartial = Pick<
  Issue,
  | "id"
  | "title"
  | "url"
  | "identifier"
  | "description"
  | "branchName"
  | "sortOrder"
> & {
  assignee: Pick<User, "displayName">;
  state: Pick<WorkflowState, "type" | "name">;
  attachments: {
    nodes: Pick<Attachment, "title" | "url" | "sourceType" | "metadata">[];
  };
};

const issueQueryFragment = `
  id,
  title,
  url,
  identifier,
  branchName,
  description,
  sortOrder,
  assignee {
    displayName
  },
  state {
    type,
    name
  }
  attachments {
    nodes {
      title,
      url,
      sourceType,
      metadata
    }
  }
`;

const issueStateFilterFragment = `
  state: {
    type: {
      in: ["triage", "backlog", "unstarted", "started"]
    }
  }
`;

export type ProjectMilestonePartial = Pick<
  ProjectMilestone,
  "id" | "name" | "sortOrder"
> & {
  projectMilestones: {
    nodes: Pick<ProjectMilestone, "id">[];
  };
  issues: {
    nodes: IssuePartial[];
  };
};

const projectMilestoneQueryFragment = `
  id,
  name,
  sortOrder,
  issues(filter: {${issueStateFilterFragment}}) {
    nodes {
      ${issueQueryFragment}
    }
  }
`;

export type ProjectPartial = Pick<
  Project,
  "id" | "name" | "url" | "progress"
> & {
  noMilestoneIssues: {
    nodes: IssuePartial[];
  };
  projectMilestones: {
    nodes: ProjectMilestonePartial[];
  };
};

const projectQueryFragment = `
  id,
  name,
  url,
  progress,
  projectMilestones {
    nodes {
      id
    }
  }
`;

const myIssuesQuery = `
  query MyIssues {
    viewer {
      assignedIssues(filter: {${issueStateFilterFragment}}) {
      nodes {
        ${issueQueryFragment}
      }
    }
    }
  }
`;

type MyIssuesResponse = {
  viewer: {
    assignedIssues: {
      nodes: IssuePartial[];
    };
  };
};

const branchIssueQuery = `
  query BranchIssue($branch: String!) {
    issueVcsBranchSearch(branchName: $branch) {
      ${issueQueryFragment}
    }
  }
`;

type BranchIssueResponse = {
  issueVcsBranchSearch: IssuePartial;
};

const favoritesQuery = `
  query Favorites {
    favorites {
      nodes {
        sortOrder,
        type,
        issue {
          ${issueQueryFragment}
        }
        project {
          ${projectQueryFragment}
        }
      }
    }
  }
`;

type FavoritesResponse = {
  favorites: {
    nodes: {
      sortOrder: Favorite["sortOrder"];
      type: Favorite["type"];
      issue?: IssuePartial;
      project?: ProjectPartial;
    }[];
  };
};

const noMilestoneQuery = `
  query NoMilestone($id: String!) {
    issues(
      filter: {
        ${issueStateFilterFragment},
        project: {id: {eq: $id}}},
        projectMilestone: {null: true}
      }
    ) {
      nodes {
        ${issueQueryFragment}
      }
    }
  }
`;
