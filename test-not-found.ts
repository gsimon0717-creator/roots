async function testNonExistentTask() {
  try {
    const res = await fetch('http://localhost:3000/api/tasks/999999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: 1 })
    });
    console.log('Status for non-existent task:', res.status);
    console.log('Body:', await res.json());
  } catch (e) {
    console.error(e);
  }
}
testNonExistentTask();
