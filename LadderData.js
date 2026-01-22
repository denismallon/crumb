/**
 * Milk and Egg Ladder Data
 * Used for allergy introduction tracking
 */

export const MILK_LADDER = [
  {
    step: 1,
    name: 'Baked milk (extensively heated)',
    foods: [
      'Malted milk biscuits',
      'Digestive biscuits',
      'Rich tea biscuits',
      'Shortbread biscuits'
    ]
  },
  {
    step: 2,
    name: 'Baked milk (larger amounts)',
    foods: [
      'Chocolate muffin',
      'Victoria sponge cake',
      'Cupcakes',
      'Fairy cakes',
      'Scones',
      'Yorkshire pudding'
    ]
  },
  {
    step: 3,
    name: 'Heated milk (other foods)',
    foods: [
      'Pancakes',
      'Waffles',
      'Crumpets',
      'Brioche',
      'Custard (baked)',
      'White sauce (béchamel)'
    ]
  },
  {
    step: 4,
    name: 'Pasteurised cheese',
    foods: [
      'Cheddar cheese (mild)',
      'Red Leicester cheese',
      'Edam cheese',
      'Parmesan cheese',
      'Mozzarella (pizza)'
    ]
  },
  {
    step: 5,
    name: 'Yogurt',
    foods: [
      'Natural yoghurt (live cultures)',
      'Greek yogurt',
      'Fruit yogurt',
      'Fromage frais'
    ]
  },
  {
    step: 6,
    name: 'Butter/margarine',
    foods: [
      'Butter (on toast)',
      'Butter (in mashed potato)',
      'Dairy margarine/spread'
    ]
  },
  {
    step: 7,
    name: 'Cream cheese/soft cheese',
    foods: [
      'Cream cheese (Philadelphia)',
      'Soft cheese spread',
      'Mascarpone',
      'Ricotta cheese'
    ]
  },
  {
    step: 8,
    name: 'Fresh milk',
    foods: [
      'Fresh cow\'s milk (small sip)',
      'Fresh cow\'s milk (in cereal)',
      'Fresh cow\'s milk (drink)'
    ]
  }
];

export const EGG_LADDER = [
  {
    step: 1,
    name: 'Well-baked egg (wheat matrix)',
    foods: [
      'Sponge cake',
      'Chocolate cake',
      'Muffins (homemade)',
      'Cupcakes',
      'Victoria sponge',
      'Fairy cakes'
    ]
  },
  {
    step: 2,
    name: 'Less well-baked egg',
    foods: [
      'Egg biscuits/cookies',
      'Shortbread (with egg)',
      'Pancakes (well-cooked)',
      'Waffles',
      'Brioche',
      'French toast',
      'Quiche (well-baked)',
      'Egg pasta (cooked)'
    ]
  },
  {
    step: 3,
    name: 'Lightly cooked egg',
    foods: [
      'Scrambled egg (well-cooked)',
      'Scrambled egg (soft)',
      'Omelette (well-done)',
      'Fried egg (hard)',
      'Boiled egg (hard-boiled)',
      'Poached egg (firm)',
      'Egg fried rice'
    ]
  },
  {
    step: 4,
    name: 'Raw/runny egg',
    foods: [
      'Soft-boiled egg',
      'Poached egg (soft yolk)',
      'Fried egg (runny yolk)',
      'Mayonnaise',
      'Chocolate mousse (raw egg)'
    ]
  }
];

export const LADDER_TYPES = {
  MILK: 'milk',
  EGG: 'egg'
};
