import { 
  validateBulkImportRows, 
  validateEan13CheckDigit, 
  calculateEan13CheckDigit, 
  generateEan13Barcode,
  autoMatchColumns,
  sanitizeCellValue,
  processImportInChunks
} from './bulkImport';
import { InventoryItem, Category, Warehouse } from '../types';

function runTests() {
  console.log('🧪 Starting Bulk Import Validation Unit Tests...\n');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failedCount++;
    }
  }

  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Fabrics' },
    { id: 'cat-2', name: 'Threads' }
  ];

  const mockWarehouses: Warehouse[] = [
    { id: 'wh-1', name: 'Main Warehouse', location: 'Mumbai' },
    { id: 'wh-2', name: 'Secondary Depot', location: 'Pune' }
  ];

  const mockInventory: InventoryItem[] = [
    {
      id: 'item-1',
      sku: 'SKU-EXISTING-01',
      name: 'Existing Cotton Fabric',
      barcode: '4006381333931',
      categoryId: 'cat-1',
      unit: 'meters',
      currentStock: 100,
      minStock: 20,
      dailyConsumption: 5,
      leadTime: 3,
      safetyStock: 10
    }
  ];

  const standardMapping = {
    sku: 'SKU',
    name: 'Item Name',
    category: 'Category',
    unit: 'Unit',
    currentStock: 'Current Stock',
    minStock: 'Minimum Threshold',
    safetyStock: 'Safety Stock',
    dailyConsumption: 'Daily Usage',
    leadTime: 'Lead Time (days)',
    barcode: 'Barcode',
    warehouse: 'Warehouse'
  };

  // Test 1: Missing required field (e.g. SKU and Item Name)
  console.log('Test 1: Missing required field');
  {
    const rows = [
      { 'SKU': '', 'Item Name': 'Test Item', 'Category': 'Fabrics', 'Unit': 'meters' },
      { 'SKU': 'SKU-999', 'Item Name': '', 'Category': 'Fabrics', 'Unit': 'meters' }
    ];
    const results = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: false,
      duplicatePolicy: 'skip'
    });

    assert(!results[0].isValid && results[0].errors.some(e => e.includes('SKU is required')), 'Row 1 invalid due to missing SKU');
    assert(!results[1].isValid && results[1].errors.some(e => e.includes('Item Name is required')), 'Row 2 invalid due to missing Item Name');
  }

  // Test 2: Duplicate SKU inside file
  console.log('\nTest 2: Duplicate SKU in file');
  {
    const rows = [
      { 'SKU': 'SKU-DUP-FILE', 'Item Name': 'First Item', 'Category': 'Fabrics', 'Unit': 'meters' },
      { 'SKU': 'SKU-DUP-FILE', 'Item Name': 'Second Item', 'Category': 'Fabrics', 'Unit': 'meters' }
    ];
    const results = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: false,
      duplicatePolicy: 'skip'
    });

    assert(results[0].isValid, 'First occurrence is valid');
    assert(results[1].isDuplicateInFile === true, 'Second occurrence detected as duplicate in file');
    assert(results[1].warnings.some(w => w.includes('Duplicate SKU')), 'Row 2 warning explains duplicate SKU will be skipped under skip policy');
  }

  // Test 3: Duplicate SKU against existing items
  console.log('\nTest 3: Duplicate against existing');
  {
    const rows = [
      { 'SKU': 'SKU-EXISTING-01', 'Item Name': 'Duplicated Existing', 'Category': 'Fabrics', 'Unit': 'meters' }
    ];
    // Under 'skip' policy
    const skipResults = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: false,
      duplicatePolicy: 'skip'
    });
    assert(skipResults[0].isDuplicateInExisting === true, 'Detected duplicate against existing inventory under skip policy');

    // Under 'reject' policy
    const rejectResults = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: false,
      duplicatePolicy: 'reject'
    });
    assert(!rejectResults[0].isValid && rejectResults[0].errors.some(e => e.includes('already exists in inventory')), 'Rejected under reject policy');

    // Under 'update' policy
    const updateResults = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: false,
      duplicatePolicy: 'update'
    });
    assert(updateResults[0].isValid && updateResults[0].warnings.some(w => w.includes('will update existing item')), 'Allowed and flagged for update under update policy');
  }

  // Test 4: Negative number
  console.log('\nTest 4: Negative number');
  {
    const rows = [
      { 'SKU': 'SKU-NEG', 'Item Name': 'Negative Stock Item', 'Category': 'Fabrics', 'Unit': 'meters', 'Current Stock': '-25' }
    ];
    const results = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: false,
      duplicatePolicy: 'skip'
    });

    assert(!results[0].isValid, 'Row marked invalid');
    assert(results[0].errors.some(e => e.includes('cannot be negative (-25)')), 'Correct error for negative stock');
  }

  // Test 5: Bad barcode check digit
  console.log('\nTest 5: Bad barcode check digit & EAN-13 generator');
  {
    // Valid barcode: 4006381333931 (EAN-13 check digit is 1)
    assert(validateEan13CheckDigit('4006381333931'), 'Valid check digit passes');
    // Invalid barcode with bad check digit (ends in 9 instead of 1)
    assert(!validateEan13CheckDigit('4006381333939'), 'Invalid check digit fails');
    // Invalid length
    assert(!validateEan13CheckDigit('12345'), 'Too short barcode fails');

    // Generator produces valid EAN-13
    const generated = generateEan13Barcode();
    assert(generated.length === 13, 'Generated barcode has 13 digits');
    assert(validateEan13CheckDigit(generated), 'Generated barcode has mathematically valid EAN-13 check digit');

    // Row check with bad barcode
    const rows = [
      { 'SKU': 'SKU-BAD-BAR', 'Item Name': 'Bad Barcode Item', 'Category': 'Fabrics', 'Unit': 'meters', 'Barcode': '4006381333939' }
    ];
    const results = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: false,
      duplicatePolicy: 'skip'
    });
    assert(!results[0].isValid && results[0].errors.some(e => e.includes('invalid EAN-13 check digit')), 'Row rejected for bad barcode check digit');
  }

  // Test 6: Unknown category
  console.log('\nTest 6: Unknown category');
  {
    const rows = [
      { 'SKU': 'SKU-NEW-CAT', 'Item Name': 'Silk Scarf', 'Category': 'Silks & Satins', 'Unit': 'pcs' }
    ];
    
    // When createMissingCategoriesWarehouses = false
    const resultsNoCreate = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: false,
      duplicatePolicy: 'skip'
    });
    assert(!resultsNoCreate[0].isValid && resultsNoCreate[0].errors.some(e => e.includes("Category 'Silks & Satins' does not exist")), 'Error when createMissing is disabled');

    // When createMissingCategoriesWarehouses = true
    const resultsWithCreate = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: true,
      duplicatePolicy: 'skip'
    });
    assert(resultsWithCreate[0].isValid && resultsWithCreate[0].warnings.some(w => w.includes('New Category')), 'Valid with warning when createMissing is enabled');
  }

  // Test 7: Formula injection cell
  console.log('\nTest 7: Formula injection cell');
  {
    const formulaInjections = [
      '=SUM(A1:A10)',
      '+cmd|/c calc!A0',
      '@2+3',
      '-@cmd|calc'
    ];

    for (const injected of formulaInjections) {
      const sanitizedRes = sanitizeCellValue(injected);
      assert(sanitizedRes.hasFormulaInjection, `Formula injection detected for: ${injected}`);
    }

    // Normal negative number should NOT be flagged as formula injection
    const normalNegative = sanitizeCellValue('-50');
    assert(!normalNegative.hasFormulaInjection, 'Normal negative number -50 is not flagged as formula injection');

    // Row check with formula injection in description
    const rows = [
      { 'SKU': 'SKU-INJ', 'Item Name': '=cmd|/c calc', 'Category': 'Fabrics', 'Unit': 'meters' }
    ];
    const results = validateBulkImportRows(rows, standardMapping, {
      existingInventory: mockInventory,
      existingCategories: mockCategories,
      existingWarehouses: mockWarehouses,
      createMissingCategoriesWarehouses: false,
      duplicatePolicy: 'skip'
    });
    assert(!results[0].isValid && results[0].errors.some(e => e.includes('contains forbidden formula characters')), 'Row with formula injection cell is blocked');
  }

  // Test 8: Chunk processing
  console.log('\nTest 8: Chunk processing for 2,000 items');
  {
    const largeDataset = Array.from({ length: 2000 }, (_, i) => ({ id: i }));
    let progressUpdates: number[] = [];
    processImportInChunks(
      largeDataset,
      100,
      (chunk) => chunk.map(c => c.id * 2),
      (progress) => progressUpdates.push(progress)
    ).then((finalResults) => {
      assert(finalResults.length === 2000, 'All 2,000 items processed through chunks');
      assert(progressUpdates.length > 0 && progressUpdates[progressUpdates.length - 1] === 100, 'Progress reached 100%');
      console.log(`\n🎉 Results: ${passedCount} passed, ${failedCount} failed.`);
      if (failedCount > 0) process.exit(1);
    });
  }
}

runTests();
