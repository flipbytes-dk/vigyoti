const { deleteDoc, collection, doc, query, where, getDocs } = require('firebase/firestore');
const { db } = require('../lib/firebase');

async function deleteWorkspace() {
  try {
    // First, get all projects in this workspace
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, where('workspaceId', '==', 'fHOESZhcrvuGH3x3C3mF'));
    const querySnapshot = await getDocs(q);

    // Delete all projects in this workspace
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Delete the workspace itself
    const workspaceRef = doc(db, 'workspaces', 'fHOESZhcrvuGH3x3C3mF');
    await deleteDoc(workspaceRef);
    console.log('Workspace deleted successfully');
  } catch (error) {
    console.error('Error deleting workspace:', error);
  }
}

deleteWorkspace(); 