import { WorkspaceService } from '../lib/workspace-service';

async function deleteWorkspace() {
  try {
    await WorkspaceService.deleteWorkspace('fHOESZhcrvuGH3x3C3mF');
    console.log('Workspace deleted successfully');
  } catch (error) {
    console.error('Error deleting workspace:', error);
  }
}

deleteWorkspace(); 