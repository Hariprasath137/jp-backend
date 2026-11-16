import subprocess

# Run npm install to get Node.js packages
print("Installing Node dependencies...")
subprocess.run(["npm", "install"], check=True)

# Run the actual Node.js backend (index.js)
print("Starting Node.js Backend...")
subprocess.Popen(["node", "index.js"])

# Dummy Gradio UI to keep Hugging Face happy
import gradio as gr

def greet():
    return "MotoTrack Backend is running successfully in the background!"

demo = gr.Interface(fn=greet, inputs=None, outputs="text", title="MotoTrack API Engine")
demo.launch(server_name="0.0.0.0", server_port=7860)