// Simple mock of WatermelonDB's Query operators for AsyncStorage implementation

export const Q = {
  where: (field, operator, value) => {
    if (value === undefined && operator !== undefined) {
      // Handle the shorthand where(field, value) syntax
      return {
        type: 'where',
        field,
        operator: '=',
        value: operator
      };
    }
    return {
      type: 'where',
      field,
      operator: operator || '=',
      value
    };
  },
  
  sortBy: (field, direction = 'asc') => ({
    type: 'sortBy',
    field,
    direction
  }),
  
  take: (count) => ({
    type: 'take',
    count
  }),
  
  skip: (count) => ({
    type: 'skip',
    count
  }),
  
  desc: (field) => ({
    type: 'sortBy',
    field,
    direction: 'desc'
  }),
  
  asc: (field) => ({
    type: 'sortBy',
    field,
    direction: 'asc'
  }),
  
  gt: (value) => ({
    operator: '>',
    value
  }),
  
  gte: (value) => ({
    operator: '>=',
    value
  }),
  
  lt: (value) => ({
    operator: '<',
    value
  }),
  
  lte: (value) => ({
    operator: '<=',
    value
  }),
  
  eq: (value) => ({
    operator: '=',
    value
  }),
  
  notEq: (value) => ({
    operator: '!=',
    value
  }),
  
  oneOf: (values) => ({
    operator: 'oneOf',
    value: values
  }),
};

// Helper function to apply query conditions to data
export function applyQuery(data, conditions = []) {
  if (!Array.isArray(data)) return [];
  if (!conditions.length) return data;
  
  let result = [...data];
  
  // Apply where conditions
  const whereConditions = conditions.filter(c => c && c.type === 'where');
  if (whereConditions.length) {
    result = result.filter(item => {
      return whereConditions.every(condition => {
        const { field, operator, value } = condition;
        
        // Handle null or undefined item values
        if (item[field] === undefined || item[field] === null) {
          return operator === '!=' ? value !== null : false;
        }
        
        switch (operator) {
          case '=':
            return item[field] === value;
          case '!=':
            return item[field] !== value;
          case '>':
            return item[field] > value;
          case '>=':
            return item[field] >= value;
          case '<':
            return item[field] < value;
          case '<=':
            return item[field] <= value;
          case 'oneOf':
            return Array.isArray(value) && value.includes(item[field]);
          default:
            return true;
        }
      });
    });
  }
  
  // Apply sorting
  const sortConditions = conditions.filter(c => c && c.type === 'sortBy');
  if (sortConditions.length) {
    result.sort((a, b) => {
      for (const { field, direction } of sortConditions) {
        if (a[field] === undefined || b[field] === undefined) continue;
        if (a[field] < b[field]) return direction === 'asc' ? -1 : 1;
        if (a[field] > b[field]) return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
  
  // Apply pagination
  const skip = conditions.find(c => c && c.type === 'skip')?.count || 0;
  if (skip) {
    result = result.slice(skip);
  }
  
  const take = conditions.find(c => c && c.type === 'take')?.count;
  if (take !== undefined) {
    result = result.slice(0, take);
  }
  
  return result;
}
