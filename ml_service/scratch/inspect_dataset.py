import pandas as pd
import os

dataset_path = "/home/sanjay/Downloads/ReviewLens/ml_service/merged_reviews_dataset.xlsx"
df = pd.read_excel(dataset_path)

print("Class 1 (Genuine) sample reviews:")
for r in df[df['label'] == 1]['review'].head(10):
    print("-", r)

print("\nClass 0 (Fake/Suspicious) sample reviews:")
for r in df[df['label'] == 0]['review'].head(10):
    print("-", r)

print("\nChecking for exact duplicate reviews:")
print("Number of duplicate reviews:", df['review'].duplicated().sum())

print("\nLet's see if there are standard template patterns. Number of unique reviews in Class 1:")
print(df[df['label'] == 1]['review'].nunique())
print("Number of unique reviews in Class 0:")
print(df[df['label'] == 0]['review'].nunique())
