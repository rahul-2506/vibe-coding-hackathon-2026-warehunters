import sys
import os

# Add parent directories to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services import inference

print("Starting model training test...")
success = inference.train_model()
print("Success:", success)
if success:
    print(f"Accuracy: {inference.model_accuracy * 100:.2f}%")
    print("Is trained:", inference.is_trained)
else:
    print("Model training failed.")
