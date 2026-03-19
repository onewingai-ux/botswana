FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# We don't expose 8000 here because the root Dockerfile handles the final assembly
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
