
import re

def count_pure_braces(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Remove strings
    content = re.sub(r'"(?:\\.|[^"\\])*"', '""', content)
    content = re.sub(r"'(?:\\.|[^'\\])*'", "''", content)
    content = re.sub(r"`(?:\\.|[^`\\])*`", "``", content)
    
    # Remove comments
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    open_count = content.count('{')
    close_count = content.count('}')
    
    print(f"Pure {{: {open_count}")
    print(f"Pure }}: {close_count}")
    print(f"Difference: {open_count - close_count}")

if __name__ == "__main__":
    import sys
    count_pure_braces(sys.argv[1])
