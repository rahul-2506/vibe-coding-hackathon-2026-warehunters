import pandas as pd

data = {
    'review': [
        'Best facewash for acne, salicylic acid really works!',
        'Natural ingredients like neem helped my skin a lot.',
        'Vitamin C brightens and gives a nice glow.',
        'Total waste of money, do not buy this product.',
        'Bad quality, gave me rashes and oily skin.',
        'Fake product, nothing like what was advertised.',
        'I love this so much, highly recommended for dry skin.',
        'Gentle cleansing and very hydrating.',
        'Pimples reduced significantly in a week.',
        'Scam alert, the bottle was half empty and smelled bad.',
        'Great oil control and no breakouts.',
        'It is just plain water, doesn\'t do anything.',
        'Amazing smell and texture, soft skin feeling.',
        'Horrible experience, ruined my skin barrier.',
        'The hyaluronic acid keeps me plump all day.'
    ],
    'label': [1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1]  # 1 = REAL, 0 = FAKE
}

df = pd.DataFrame(data)
df.to_excel('merged_reviews_dataset.xlsx', index=False)
print("Dataset created successfully!")
