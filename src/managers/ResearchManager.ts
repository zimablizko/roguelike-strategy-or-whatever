import {
  getAllResearchDefinitions,
  getResearchDefinition,
  isResearchId,
  researchTreeOrder,
} from '../data/researches';
import type {
  ActiveResearchState,
  CompletedResearchSummary,
  ResearchAdvanceResult,
  ResearchProgress,
  ResearchStartStatus,
} from '../_common/models/research-manager.models';
import type {
  ResearchId,
  ResearchTreeId,
  TypedResearchDefinition,
} from '../_common/models/researches.models';
import { BuildingManager } from './BuildingManager';

export class ResearchManager {
  private readonly buildingManager: BuildingManager;
  private activeResearch?: ActiveResearchState;
  private readonly completedResearches = new Set<ResearchId>();
  private latestCompletion?: CompletedResearchSummary;
  private researchVersion = 0;

  constructor(
    buildingManager: BuildingManager,
    options?: {
      initial?: {
        activeResearch?: ActiveResearchState;
        completedResearches?: ResearchId[];
        latestCompletion?: CompletedResearchSummary;
        researchVersion?: number;
      };
    }
  ) {
    this.buildingManager = buildingManager;
    this.bootstrap(options?.initial);
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

  getActiveResearchState(): ActiveResearchState | undefined {
    if (!this.activeResearch) {
      return undefined;
    }
    return { ...this.activeResearch };
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

  getCompletedResearchIds(): ResearchId[] {
    return Array.from(this.completedResearches.values());
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
        this.buildingManager.unlockTechnology(completedDefinition.id);
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

  private bootstrap(initial?: {
    activeResearch?: ActiveResearchState;
    completedResearches?: ResearchId[];
    latestCompletion?: CompletedResearchSummary;
    researchVersion?: number;
  }): void {
    this.completedResearches.clear();
    this.activeResearch = undefined;
    this.latestCompletion = undefined;
    this.researchVersion = Math.max(
      0,
      Math.floor(initial?.researchVersion ?? 0)
    );

    const completedFromSave = initial?.completedResearches ?? [];
    if (completedFromSave.length > 0) {
      for (const id of completedFromSave) {
        if (isResearchId(id)) {
          this.completedResearches.add(id);
          this.buildingManager.unlockTechnology(id);
        }
      }
    } else {
      this.bootstrapFromUnlockedTechnologies();
    }

    if (initial?.activeResearch && isResearchId(initial.activeResearch.id)) {
      this.activeResearch = {
        id: initial.activeResearch.id,
        startedOnTurn: Math.max(1, Math.floor(initial.activeResearch.startedOnTurn)),
        totalTurns: Math.max(1, Math.floor(initial.activeResearch.totalTurns)),
        remainingTurns: Math.max(
          0,
          Math.floor(initial.activeResearch.remainingTurns)
        ),
      };
    }

    if (
      initial?.latestCompletion &&
      isResearchId(initial.latestCompletion.id)
    ) {
      const definition = getResearchDefinition(initial.latestCompletion.id);
      if (definition) {
        this.latestCompletion = {
          id: definition.id,
          name: definition.name,
          tree: definition.tree,
          completedOnTurn: Math.max(
            1,
            Math.floor(initial.latestCompletion.completedOnTurn)
          ),
        };
      }
    }
  }

  private bootstrapFromUnlockedTechnologies(): void {
    for (const technology of this.buildingManager.getUnlockedTechnologies()) {
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
