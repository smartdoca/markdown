import { CollaborativeMarkdownEditor } from './lib'
import { DEFAULT_MARKDOWN } from './editor/collaboration'
import { uploadImageToEndpoint } from './editor/upload'
import { HostManagedDemo } from './HostManagedDemo'

function roomFromLocation() {
  const room = new URLSearchParams(location.search).get('room')
  return room?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'welcome'
}

export function App() {
  const params = new URLSearchParams(location.search)
  if (params.get('host') === '1') return <HostManagedDemo readOnly={params.get('readonly') === '1'} />
  return <CollaborativeMarkdownEditor roomId={roomFromLocation()}
    websocketUrl={import.meta.env.VITE_COLLAB_URL || 'ws://localhost:1234'} initialValue={DEFAULT_MARKDOWN}
    uploadImage={file => uploadImageToEndpoint(file, import.meta.env.VITE_UPLOAD_URL)} />
}
