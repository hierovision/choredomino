/**
 * Sync Tests
 * Comprehensive tests for IndexedDB + Supabase sync functionality
 * 
 * Run these tests manually in the browser console
 * or integrate with a test framework like Vitest
 */

import {
  initDatabase,
  insert,
  upsert,
  getAll,
  getById,
  remove,
  forceSyncAll,
  getSyncStatus
} from './index'
import type { HouseholdDocument, UserDocument, ChoreDocument } from './schemas'

/**
 * Test 1: Database Persistence
 * Verify that data persists across page reloads
 */
export async function testPersistence() {
  console.log('[Test] Starting persistence test...')
  
  await initDatabase()
  
  const testHousehold: HouseholdDocument = {
    id: 'test-household-1',
    name: 'Test Household',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'test-user',
    choreManagementMode: 'collaborative',
    rewardManagementMode: 'collaborative',
    defaultChoreLifecycle: 'simple',
    allowAssignmentAcceptance: false,
    settings: {
      timezone: 'America/New_York',
      currency: 'USD',
      pointsPerChore: 10
    },
    modified: Date.now()
  }
  
  await insert('households', testHousehold)
  
  const retrieved = await getById<HouseholdDocument>('households', 'test-household-1')
  
  if (retrieved && retrieved.name === 'Test Household') {
    console.log('✅ Data inserted successfully')
    console.log('🔄 Now reload the page and run testPersistenceVerify()')
    return true
  } else {
    console.error('❌ Failed to insert data')
    return false
  }
}

export async function testPersistenceVerify() {
  console.log('[Test] Verifying persistence after reload...')
  
  await initDatabase()
  
  const retrieved = await getById<HouseholdDocument>('households', 'test-household-1')
  
  if (retrieved && retrieved.name === 'Test Household') {
    console.log('✅ Data persisted across reload!')
    await remove('households', 'test-household-1', true)
    return true
  } else {
    console.error('❌ Data did NOT persist!')
    return false
  }
}

/**
 * Test 2: CRUD Operations
 * Test Create, Read, Update, Delete operations
 */
export async function testCRUD() {
  console.log('[Test] Starting CRUD operations test...')
  
  await initDatabase()
  
  // CREATE
  const testUser: UserDocument = {
    id: 'test-user-crud',
    householdId: 'test-household',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
    points: 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    modified: Date.now()
  }
  
  await insert('users', testUser)
  console.log('✅ CREATE: User inserted')
  
  // READ
  const user = await getById<UserDocument>('users', 'test-user-crud')
  if (!user || user.name !== 'Test User') {
    console.error('❌ READ: Failed to read user')
    return false
  }
  console.log('✅ READ: User retrieved')
  
  // UPDATE
  const updatedUser = { ...user, name: 'Updated User', points: 200 }
  await upsert('users', updatedUser)
  
  const userAfterUpdate = await getById<UserDocument>('users', 'test-user-crud')
  if (!userAfterUpdate || userAfterUpdate.name !== 'Updated User' || userAfterUpdate.points !== 200) {
    console.error('❌ UPDATE: Failed to update user')
    return false
  }
  console.log('✅ UPDATE: User updated')
  
  // SOFT DELETE
  await remove('users', 'test-user-crud', false)
  const userAfterSoftDelete = await getById<UserDocument>('users', 'test-user-crud')
  if (!userAfterSoftDelete || !userAfterSoftDelete.isDeleted) {
    console.error('❌ SOFT DELETE: Failed to soft delete')
    return false
  }
  console.log('✅ SOFT DELETE: User soft deleted')
  
  // HARD DELETE
  await remove('users', 'test-user-crud', true)
  const userAfterHardDelete = await getById<UserDocument>('users', 'test-user-crud')
  if (userAfterHardDelete) {
    console.error('❌ HARD DELETE: User still exists')
    return false
  }
  console.log('✅ HARD DELETE: User removed')
  
  return true
}

/**
 * Test 3: Bulk Operations
 * Test bulk insert/upsert performance
 */
export async function testBulkOperations() {
  console.log('[Test] Starting bulk operations test...')
  
  await initDatabase()
  
  const startTime = Date.now()
  
  // Create 100 chores
  const chores: ChoreDocument[] = []
  for (let i = 0; i < 100; i++) {
    chores.push({
      id: `test-chore-${i}`,
      householdId: 'test-household',
      name: `Test Chore ${i}`,
      description: `Description for chore ${i}`,
      points: 10,
      frequency: 'daily',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test-user',
      modified: Date.now()
    })
  }
  
  // Insert them one by one
  for (const chore of chores) {
    await insert('chores', chore)
  }
  
  const endTime = Date.now()
  console.log(`✅ Inserted 100 chores in ${endTime - startTime}ms`)
  
  // Verify they exist
  const allChores = await getAll<ChoreDocument>('chores')
  const testChores = allChores.filter(c => c.id.startsWith('test-chore-'))
  
  if (testChores.length === 100) {
    console.log('✅ All 100 chores verified')
  } else {
    console.error(`❌ Expected 100 chores, found ${testChores.length}`)
    return false
  }
  
  // Cleanup
  for (let i = 0; i < 100; i++) {
    await remove('chores', `test-chore-${i}`, true)
  }
  console.log('✅ Cleanup complete')
  
  return true
}

/**
 * Test 4: Sync Status
 * Verify sync system is working
 */
export async function testSyncStatus() {
  console.log('[Test] Testing sync status...')
  
  await initDatabase()
  
  const status = getSyncStatus()
  
  console.log('Sync Status:', status)
  
  if (!status.isOnline) {
    console.warn('⚠️  You are offline - sync disabled')
    return true
  }
  
  if (status.activeChannels.length === 6) {
    console.log('✅ All 6 realtime channels active:', status.activeChannels)
    return true
  } else {
    console.error(`❌ Expected 6 channels, found ${status.activeChannels.length}`)
    return false
  }
}

/**
 * Test 5: Offline Mode
 * Test that app works offline
 */
export async function testOfflineMode() {
  console.log('[Test] Testing offline mode...')
  console.log('⚠️  Open DevTools > Network tab > Set throttling to "Offline"')
  console.log('Then run this test again')
  
  await initDatabase()
  
  if (!navigator.onLine) {
    console.log('✅ Browser is offline')
    
    // Try to write data
    const testHousehold: HouseholdDocument = {
      id: 'offline-test',
      name: 'Offline Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test',
      choreManagementMode: 'collaborative',
      rewardManagementMode: 'collaborative',
      defaultChoreLifecycle: 'simple',
      allowAssignmentAcceptance: false,
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        pointsPerChore: 5
      },
      modified: Date.now()
    }
    
    await insert('households', testHousehold)
    const retrieved = await getById<HouseholdDocument>('households', 'offline-test')
    
    if (retrieved) {
      console.log('✅ Data written while offline!')
      console.log('🔄 Now go back online and run forceSyncAll() to sync')
      return true
    } else {
      console.error('❌ Failed to write offline')
      return false
    }
  } else {
    console.warn('⚠️  You are still online - set network to offline first')
    return false
  }
}

/**
 * Test 6: Force Sync
 * Manually trigger sync
 */
export async function testForceSync() {
  console.log('[Test] Testing force sync...')
  
  await forceSyncAll()
  
  console.log('✅ Force sync completed')
  console.log('Check console for sync activity')
  
  return true
}

/**
 * Test 7: Multi-tab Sync
 * Test that changes sync across browser tabs
 */
export async function testMultiTab() {
  console.log('[Test] Testing multi-tab sync...')
  console.log('🔄 Open this app in another tab and run testMultiTabWrite()')
  console.log('Then come back here and run testMultiTabRead()')
  
  return true
}

export async function testMultiTabWrite() {
  console.log('[Test] Writing data for multi-tab test...')
  
  await initDatabase()
  
  const testData: HouseholdDocument = {
    id: 'multi-tab-test',
    name: `Multi-tab Test ${Date.now()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'multi-tab',
    choreManagementMode: 'collaborative',
    rewardManagementMode: 'collaborative',
    defaultChoreLifecycle: 'simple',
    allowAssignmentAcceptance: false,
    settings: {
      timezone: 'UTC',
      currency: 'USD',
      pointsPerChore: 15
    },
    modified: Date.now()
  }
  
  await insert('households', testData)
  console.log('✅ Data written:', testData.name)
  console.log('🔄 Now switch to the other tab and run testMultiTabRead()')
  
  return true
}

export async function testMultiTabRead() {
  console.log('[Test] Reading data from other tab...')
  
  await initDatabase()
  
  // Wait a bit for realtime to propagate
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const data = await getById<HouseholdDocument>('households', 'multi-tab-test')
  
  if (data && data.name.startsWith('Multi-tab Test')) {
    console.log('✅ Data synced across tabs!', data.name)
    await remove('households', 'multi-tab-test', true)
    return true
  } else {
    console.error('❌ Data did not sync')
    return false
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('==========================================')
  console.log('🧪 Running All Sync Tests')
  console.log('==========================================\n')
  
  const results: { test: string; passed: boolean }[] = []
  
  try {
    results.push({ test: 'Persistence', passed: await testPersistence() })
    results.push({ test: 'CRUD Operations', passed: await testCRUD() })
    results.push({ test: 'Bulk Operations', passed: await testBulkOperations() })
    results.push({ test: 'Sync Status', passed: await testSyncStatus() })
    results.push({ test: 'Force Sync', passed: await testForceSync() })
    
    console.log('\n==========================================')
    console.log('📊 Test Results')
    console.log('==========================================')
    
    results.forEach(({ test, passed }) => {
      console.log(`${passed ? '✅' : '❌'} ${test}`)
    })
    
    const passedCount = results.filter(r => r.passed).length
    console.log(`\n${passedCount}/${results.length} tests passed`)
    
    console.log('\n⚠️  Manual tests remaining:')
    console.log('  - testPersistenceVerify() - after page reload')
    console.log('  - testOfflineMode() - with network offline')
    console.log('  - testMultiTab() - across browser tabs')
    
  } catch (err) {
    console.error('❌ Test suite failed:', err)
  }
}

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as any).syncTests = {
    runAllTests,
    testPersistence,
    testPersistenceVerify,
    testCRUD,
    testBulkOperations,
    testSyncStatus,
    testOfflineMode,
    testForceSync,
    testMultiTab,
    testMultiTabWrite,
    testMultiTabRead
  }
  
  console.log('[Tests] Sync tests loaded! Run: syncTests.runAllTests()')
}
