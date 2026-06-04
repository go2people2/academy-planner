
import re

def check_braces(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Simple state machine to skip strings and comments
    stack = []
    i = 0
    line_num = 1
    col_num = 1
    
    in_string = None # '"', "'", or '`'
    in_comment = None # '//' or '/*'
    
    while i < len(content):
        char = content[i]
        
        if in_comment == '//':
            if char == '\n':
                in_comment = None
        elif in_comment == '/*':
            if char == '*' and i + 1 < len(content) and content[i+1] == '/':
                in_comment = None
                i += 1
        elif in_string:
            if char == '\\': # skip escaped char
                i += 1
            elif char == in_string:
                in_string = None
        else:
            if char == '/' and i + 1 < len(content):
                if content[i+1] == '/':
                    in_comment = '//'
                    i += 1
                elif content[i+1] == '*':
                    in_comment = '/*'
                    i += 1
            elif char in ['"', "'", '`']:
                in_string = char
            elif char == '{':
                # Check for template literal ${
                if i > 0 and content[i-1] == '$' and content[i-2:i] == '${': # Wait, this is wrong
                    pass
                # Actually, in JS/TS, ${ starts a new expression in a template literal.
                # But since we are already inside a backtick string, it would have been handled.
                # Wait, if we are in `char == '`'`, we set in_string = '`'.
                # Then we need to handle ${ inside it.
                stack.append((line_num, col_num, content.splitlines()[line_num-1]))
            elif char == '}':
                if not stack:
                    print(f"Extra '}}' at line {line_num}, col {col_num}")
                else:
                    stack.pop()
        
        if char == '\n':
            line_num += 1
            col_num = 1
        else:
            col_num += 1
        i += 1

    if stack:
        print(f"Unclosed '{{':")
        for l, c, cont in stack:
            print(f"  Line {l}, col {c}: {cont}")
    else:
        print("Braces are balanced.")

if __name__ == "__main__":
    check_braces('/Users/joonsik_air/Documents/makeCode/academy-planner/app/[slug]/student/page.tsx')
