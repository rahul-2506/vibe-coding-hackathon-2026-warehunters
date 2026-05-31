import os
import traceback
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score

# Lazy-loaded globals
model = None
vectorizer = None
is_trained = False
model_accuracy = 0.0


def train_model():
    """
    Trains the Multinomial Naive Bayes classifier.
    Exits gracefully if dataset file is not found.
    """
    global model, vectorizer, is_trained, model_accuracy
    dataset_name = "merged_reviews_dataset.xlsx"
    dataset_path = os.path.join(os.path.dirname(__file__), "..", dataset_name)

    if not os.path.exists(dataset_path):
        print(f"[INFERENCE SERVICE] Dataset not found at: {dataset_path}. Unable to train classifier.")
        return False

    try:
        print("[INFERENCE SERVICE] Training reviews classifier dynamically on demand...")
        df = pd.read_excel(dataset_path)
        df = df.dropna()
        # Drop duplicates on the review column to prevent data leakage/memorization across train-test split
        df = df.drop_duplicates(subset=["review"])

        X = df["review"]
        y = df["label"]

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # Token pattern matches emojis and special skincare symbols
        vectorizer = TfidfVectorizer(
            stop_words="english", 
            ngram_range=(1, 2), 
            max_features=15000, 
            min_df=1,
            token_pattern=r"(?u)\b\w\w+\b|[\u263a-\U0001f645]"
        )
        X_train_vec = vectorizer.fit_transform(X_train)
        
        model = MultinomialNB(alpha=0.3)
        model.fit(X_train_vec, y_train)
        
        # Calculate Accuracy on test split
        X_test_vec = vectorizer.transform(X_test)
        y_pred = model.predict(X_test_vec)
        model_accuracy = accuracy_score(y_test, y_pred)
        
        is_trained = True
        print(f"[INFERENCE SERVICE] Dynamic training complete! Model accuracy: {model_accuracy * 100:.2f}%")
        return True
        
    except Exception as e:
        print(f"[INFERENCE SERVICE] Failed to train model: {e}")
        traceback.print_exc()
        return False


def predict_authenticity(review_text):
    """
    Returns REAL or FAKE for a given review text.
    Fails safely and returns REAL as a benign default if training/dataset fails.
    """
    global model, vectorizer, is_trained
    if not review_text:
        return "REAL"

    # Lazy-load and train if classifier is not ready
    if not is_trained or model is None or vectorizer is None:
        success = train_model()
        if not success:
            print("[INFERENCE SERVICE] Model training failed. Returning benign default 'REAL'.")
            return "REAL"

    try:
        vec = vectorizer.transform([review_text])
        pred = model.predict(vec)[0]
        # label 1 = REAL, 0 = FAKE
        return "REAL" if pred == 1 else "FAKE"
    except Exception as e:
        print(f"[INFERENCE SERVICE] Prediction error: {e}")
        return "REAL"
