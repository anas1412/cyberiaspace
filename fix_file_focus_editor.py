import sys

file_path = 'src/components/editors/FileFocusEditor.tsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

# Add import
if 'import { useModalStore } from' not in "".join(lines):
    lines.insert(4, "import { useModalStore } from '../../store/useModalStore';\n")

# Update the confirm block
content = "".join(lines)
old_block = """                onClick={async () => {
                  if (confirm('Remove from cloud? This will make the file inaccessible on other devices until re-synced.')) {
                    setIsUnsyncing(true);
                    try {
                      await useAuthStore.getState().removeCloudAsset(thought.id);
                    } catch (err) {
                      console.error('Unsync error:', err);
                    } finally {
                      setIsUnsyncing(false);
                    }
                  }
                }}"""

new_block = """                onClick={() => {
                  useModalStore.getState().openModal({
                    title: 'Remove from Cloud?',
                    description: 'This will delete the remote file to free up your quota. The original file will remain safely in your browser cache on this device.',
                    type: 'alert',
                    confirmText: 'Remove File',
                    onConfirm: async () => {
                      setIsUnsyncing(true);
                      try {
                        await useAuthStore.getState().removeCloudAsset(thought.id);
                      } catch (err) {
                        console.error('Unsync error:', err);
                      } finally {
                        setIsUnsyncing(false);
                      }
                    }
                  });
                }}"""

if old_block in content:
    content = content.replace(old_block, new_block)
else:
    print("Could not find old_block")
    sys.exit(1)

with open(file_path, 'w') as f:
    f.write(content)
