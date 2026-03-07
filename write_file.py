import sys
path = sys.argv[1]
content = sys.stdin.read()
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
