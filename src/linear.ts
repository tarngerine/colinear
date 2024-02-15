import {
  Attachment,
  CustomView,
  Cycle,
  Favorite,
  Issue,
  IssueLabel,
  LinearClient,
  Project,
  ProjectMilestone,
  Roadmap,
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

  async cycleIssues(id: string) {
    const result = await this.linear.client.rawRequest<
      CycleIssuesResponse,
      { id: string }
    >(cycleIssuesQuery, { id });
    return result.data?.cycle.issues.nodes;
  }

  async labelIssues(id: string) {
    const result = await this.linear.client.rawRequest<
      LabelIssuesResponse,
      { id: string }
    >(labelIssuesQuery, { id });
    return result.data?.issueLabel.issues.nodes;
  }

  async customViewIssues(id: string) {
    const result = await this.linear.client.rawRequest<
      CustomViewIssuesResponse,
      { id: string }
    >(customViewIssuesQuery, { id });
    return result.data?.customView.issues.nodes;
  }

  async customViewProjects(id: string) {
    const result = await this.linear.client.rawRequest<
      { customView: { projects: { nodes: ProjectPartial[] } } },
      { id: string }
    >(customViewProjectsQuery, { id });
    return result.data?.customView.projects.nodes;
  }

  async roadmapProjects(id: string) {
    const result = await this.linear.client.rawRequest<
      { roadmap: { projects: { nodes: ProjectPartial[] } } },
      { id: string }
    >(roadmapProjectsQuery, { id });
    return result.data?.roadmap.projects.nodes;
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
    nodes: Pick<
      Attachment,
      "id" | "title" | "url" | "sourceType" | "metadata"
    >[];
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
      id,
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

export type ProjectPartial = Pick<
  Project,
  "id" | "name" | "url" | "progress" | "sortOrder"
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
  sortOrder,
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
        predefinedViewType,
        predefinedViewTeam {
          id,
          activeCycle {
            id,
            name,
            number
          }
        },
        issue {
          ${issueQueryFragment}
        }
        project {
          ${projectQueryFragment}
        }
        cycle {
          id,
          name,
          number
        }
        label {
          id,
          name
        }
        customView {
          id,
          name,
          modelName
        }
        roadmap {
          id,
          name
        }
        folderName
      }
    }
  }
`;

export type FavoritePartial = Pick<
  Favorite,
  "sortOrder" | "type" | "folderName" | "predefinedViewType"
> & {
  issue?: IssuePartial;
  project?: ProjectPartial;
  cycle?: CyclePartial;
  label?: LabelPartial;
  customView?: CustomViewPartial;
  roadmap?: RoadmapPartial;
  predefinedViewTeam?: {
    id: string;
    activeCycle: CyclePartial;
  };
  children?: {
    nodes: { id: string }[];
  };
};

type FavoritesResponse = {
  favorites: {
    nodes: FavoritePartial[];
  };
};

export type CyclePartial = Pick<Cycle, "id" | "name" | "number">;

type CycleIssuesResponse = {
  cycle: {
    issues: {
      nodes: IssuePartial[];
    };
  };
};

const cycleIssuesQuery = `
  query CycleIssues($id: String!) {
    cycle(id: $id) {
      issues {
        nodes {
          ${issueQueryFragment}
        }
      }
    }
  }
`;

export type LabelPartial = Pick<IssueLabel, "id" | "name">;

type LabelIssuesResponse = {
  issueLabel: {
    issues: {
      nodes: IssuePartial[];
    };
  };
};

const labelIssuesQuery = `
  query LabelIssues($id: String!) {
    issueLabel(id: $id) {
      issues {
        nodes {
          ${issueQueryFragment}
        }
      }
    }
  }
`;

export type CustomViewPartial = Pick<CustomView, "id" | "name" | "modelName">;

type CustomViewIssuesResponse = {
  customView: {
    issues: {
      nodes: IssuePartial[];
    };
  };
};

const customViewIssuesQuery = `
  query CustomViewIssues($id: String!) {
    customView(id: $id) {
      issues {
        nodes {
          ${issueQueryFragment}
        }
      }
    }
  }
`;

const customViewProjectsQuery = `
  query CustomViewProjects($id: String!) {
    customView(id: $id) {
      projects {
        nodes {
          ${projectQueryFragment}
        }
      }
    }
  }
`;

export type RoadmapPartial = Pick<Roadmap, "id" | "name">;

const roadmapProjectsQuery = `
  query RoadmapIssues($id: String!) {
    roadmap(id: $id) {
      projects {
        nodes {
          ${projectQueryFragment}
        }
      }
    }
  }
`;
