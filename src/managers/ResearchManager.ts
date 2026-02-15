import {
  getAllResearchDefinitions,
  getResearchDefinition,
  isResearchId,
  researchTreeOrder,
  type ResearchId,
  type ResearchTreeId,
  type TypedResearchDefinition,
} from '../data/researches';
import { StateManager } from './StateManager';

interface ActiveResearchState {
  id: ResearchId;
  startedOnTurn: number;
  totalTurns: number;
  remainingTurns: number;
}

export interface ResearchProgress extends ActiveResearchState {
  name: string;
  tree: ResearchTreeId;
}

export interface CompletedResearchSummary {
  id: ResearchId;
  name: string;
  tree: ResearchTreeId;
  completedOnTurn: number;
}

export interface ResearchAdvanceResult {
  completedResearch?: CompletedResearchSummary;
}

export interface ResearchStartStatus {
  startable: boolean;
  reason?: string;
}

export class ResearchManager {
  private readonly stateManager: StateManager;
  private activeResearch?: ActiveResearchState;
  private readonly completedResearches = new Set<ResearchId>();
  private latestCompletion?: CompletedResearchSummary;
  private researchVersion = 0;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.bootstrapFromUnlockedTechnologies();
  }

  getResearchDefinitions(): TypedResearchDefinition[] {
    return getAllResearchDefinitions();
  }

  getTreeResearchDefinitions(tree: ResearchTreeId): TypedResearchDefinition[] {
    const definitions = this.getResearchDefinitions().filter(
      (definition) => definition.tree === tree
    );
    return this.sortByTreeDepth(definitions);
  }

  getTreeOrder(): readonly ResearchTreeId[] {
    return researchTreeOrder;
  }

  getResearchDefinitionById(
    id: ResearchId
  ): TypedResearchDefinition | undefined {
    return getResearchDefinition(id);
  }

  getResearchVersion(): number {
    return this.researchVersion;
  }

  getActiveResearch(): ResearchProgress | undefined {
    if (!this.activeResearch) {
      return undefined;
    }

    const definition = getResearchDefinition(this.activeResearch.id);
    if (!definition) {
      return undefined;
    }

    return {
      ...this.activeResearch,
      name: definition.name,
      tree: definition.tree,
    };
  }

  getLatestCompletion(): CompletedResearchSummary | undefined {
    if (!this.latestCompletion) {
      return undefined;
    }
    return { ...this.latestCompletion };
  }

  getCompletedCount(): number {
    return this.completedResearches.size;
  }

  getTotalCount(): number {
    return this.getResearchDefinitions().length;
  }

  isCompleted(id: ResearchId): boolean {
    return this.completedResearches.has(id);
  }

  isActive(id: ResearchId): boolean {
    return this.activeResearch?.id === id;
  }

  canStartResearch(id: ResearchId): ResearchStartStatus {
    const definition = getResearchDefinition(id);
    if (!definition) {
      return { startable: false, reason: 'Unknown research.' };
    }

    if (this.isCompleted(id)) {
      return { startable: false, reason: 'Research already completed.' };
    }

    if (this.activeResearch) {
      return { startable: false, reason: 'Another research is in progress.' };
    }

    const missingPrerequisites = definition.requiredResearches.filter(
      (requiredId) =>
        !isResearchId(requiredId) || !this.completedResearches.has(requiredId)
    );
    if (missingPrerequisites.length > 0) {
      return {
        startable: false,
        reason: `Missing prerequisites: ${missingPrerequisites.join(', ')}`,
      };
    }

    return { startable: true };
  }

  startResearch(id: ResearchId, currentTurn: number): boolean {
    const status = this.canStartResearch(id);
    if (!status.startable) {
      return false;
    }

    const definition = getResearchDefinition(id);
    if (!definition) {
      return false;
    }

    const totalTurns = Math.max(1, Math.floor(definition.turns));
    this.activeResearch = {
      id,
      startedOnTurn: currentTurn,
      totalTurns,
      remainingTurns: totalTurns,
    };
    this.researchVersion++;
    return true;
  }

  advanceTurn(currentTurn: number): ResearchAdvanceResult {
    if (!this.activeResearch) {
      return {};
    }

    this.activeResearch.remainingTurns = Math.max(
      0,
      this.activeResearch.remainingTurns - 1
    );

    let completedResearch: CompletedResearchSummary | undefined;
    if (this.activeResearch.remainingTurns <= 0) {
      const completedDefinition = getResearchDefinition(this.activeResearch.id);
      if (completedDefinition) {
        this.completedResearches.add(completedDefinition.id);
        this.stateManager.unlockTechnology(completedDefinition.id);
        completedResearch = {
          id: completedDefinition.id,
          name: completedDefinition.name,
          tree: completedDefinition.tree,
          completedOnTurn: currentTurn,
        };
        this.latestCompletion = completedResearch;
      }
      this.activeResearch = undefined;
    }

    this.researchVersion++;
    return { completedResearch };
  }

  hasAnyStartableResearch(): boolean {
    if (this.activeResearch) {
      return false;
    }

    for (const definition of this.getResearchDefinitions()) {
      if (this.canStartResearch(definition.id).startable) {
        return true;
      }
    }
    return false;
  }

  private bootstrapFromUnlockedTechnologies(): void {
    for (const technology of this.stateManager.getUnlockedTechnologies()) {
      if (isResearchId(technology)) {
        this.completedResearches.add(technology);
      }
    }
  }

  private sortByTreeDepth(
    definitions: TypedResearchDefinition[]
  ): TypedResearchDefinition[] {
    const definitionsById = new Map<ResearchId, TypedResearchDefinition>();
    for (const definition of definitions) {
      definitionsById.set(definition.id, definition);
    }

    const depthCache = new Map<ResearchId, number>();
    const depthOf = (id: ResearchId): number => {
      const cached = depthCache.get(id);
      if (cached !== undefined) {
        return cached;
      }

      const definition = definitionsById.get(id);
      if (!definition) {
        depthCache.set(id, 0);
        return 0;
      }

      const sameTreePrerequisites = definition.requiredResearches.filter(
        (required) => isResearchId(required) && definitionsById.has(required)
      ) as ResearchId[];

      if (sameTreePrerequisites.length === 0) {
        depthCache.set(id, 0);
        return 0;
      }

      let maxDepth = 0;
      for (const prerequisiteId of sameTreePrerequisites) {
        maxDepth = Math.max(maxDepth, depthOf(prerequisiteId) + 1);
      }
      depthCache.set(id, maxDepth);
      return maxDepth;
    };

    return definitions
      .slice()
      .sort((a, b) => depthOf(a.id) - depthOf(b.id) || a.name.localeCompare(b.name));
  }
}
