
import { Recipe, AddOn } from '../types';

/**
 * Service to handle beverage cost calculations and pricing logic.
 * Requirements: REQ-001, REQ-002
 */
export class BeverageCostCalculator {
  
  /**
   * Calculates the base production cost of a beverage based on its recipe ingredients.
   * Requirement: REQ-002
   * @param recipe The beverage recipe containing ingredients with their quantities and costs.
   * @returns Total production cost.
   */
  static calculateRecipeCost(recipe: Recipe): number {
    if (!recipe || !recipe.ingredients) return 0;
    
    return recipe.ingredients.reduce((total, ing) => {
      const ingredientCost = (ing.amount * (ing.cost_per_unit || 0));
      return total + ingredientCost;
    }, 0);
  }

  /**
   * Calculates the total price of a beverage including its base price and selected add-ons.
   * Requirement: REQ-001
   * @param basePrice The base selling price of the beverage.
   * @param selectedAddOns List of selected add-ons.
   * @returns Total selling price.
   */
  static calculateTotalPrice(basePrice: number, selectedAddOns: AddOn[] = []): number {
    const addonsTotal = selectedAddOns.reduce((total, addon) => total + addon.price, 0);
    return basePrice + addonsTotal;
  }

  /**
   * Generates a detailed cost breakdown for a beverage.
   */
  static getCostBreakdown(recipe: Recipe, laborCost: number = 0, overhead: number = 0) {
    const materialCost = this.calculateRecipeCost(recipe);
    const totalCost = materialCost + laborCost + overhead;
    
    return {
      materialCost,
      laborCost,
      overhead,
      totalCost
    };
  }
}
