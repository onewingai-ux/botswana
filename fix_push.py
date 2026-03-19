import subprocess
import os

token = os.environ.get("GITHUB_TOKEN")
repo_url = f"https://onewingai-ux:{token}@github.com/onewingai-ux/botswana.git"

subprocess.run(["git", "add", "."])
subprocess.run(["git", "commit", "-m", "fix: resolve typescript build error in frontend"])
result = subprocess.run(["git", "push", repo_url, "HEAD:refs/heads/main"], capture_output=True, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
