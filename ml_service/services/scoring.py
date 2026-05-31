import math

def calculate_trust_score(reviews):
    """
    Computes an advanced trust score (0-100) and risk breakdown for a product based on reviews.
    """
    if not reviews:
        return {
            "trust_score": 80,
            "trust_label": "Trusted",
            "trust_color": "green",
            "risk_breakdown": {
                "sentiment_inconsistency": 0,
                "suspicious_ratio": 0,
                "variance_penalty": 0,
                "source_monopoly": 0
            }
        }

    total_count = len(reviews)
    inconsistent_count = 0
    suspicious_count = 0
    
    # 1. Base lists for variance and diversity
    ratings = []
    sources = set()
    
    # Standard positive/negative word sets for rapid consistency checks
    pos_words = {'good', 'great', 'love', 'best', 'effective', 'amazing', 'happy', 'clear', 'worked', 'result', 'excellent'}
    neg_words = {'bad', 'worst', 'waste', 'breakout', 'pimple', 'scam', 'hate', 'oily', 'dry', 'irritation', 'expensive', 'fake'}

    for rev in reviews:
        text = str(rev.get("review_text", "")).lower()
        rating = Number_or_default(rev.get("rating", 3))
        ratings.append(rating)
        sources.add(rev.get("source", "Customer"))

        # A. Sentiment Consistency check
        words = text.split()
        pos_hits = sum(1 for w in words if w in pos_words)
        neg_hits = sum(1 for w in words if w in neg_words)
        
        # High rating but negative words, or low rating but positive words
        if (rating >= 4 and neg_hits > pos_hits + 1) or (rating <= 2 and pos_hits > neg_hits + 1):
            inconsistent_count += 1
            
        # B. Suspicious check (Capitals abuse, excessive punctuation, spam keywords)
        caps_ratio = sum(1 for c in str(rev.get("review_text", "")) if c.isupper()) / (len(text) + 1)
        excl_count = text.count("!")
        
        spam_keywords = ["save50", "promo", "discount", "code", "coupon", "replica", "scam", "instagram", "influencer"]
        has_spam_keyword = any(k in text for k in spam_keywords)
        
        # Flag as suspicious if excessive capitals, exclamation marks, or has coupon code spam
        if caps_ratio > 0.35 or excl_count >= 3 or has_spam_keyword or rev.get("verdict") == "Suspicious":
            suspicious_count += 1

    # 2. Compute deductions
    # Deduct 1: Sentiment Inconsistency (Max 25 pts)
    incon_ratio = inconsistent_count / total_count
    incon_deduction = int(incon_ratio * 25)

    # Deduct 2: Suspicious Review Ratio (Max 35 pts)
    susp_ratio = suspicious_count / total_count
    susp_deduction = int(susp_ratio * 35)

    # Deduct 3: Rating Standard Deviation Penalty (Max 20 pts)
    avg_rating = sum(ratings) / total_count
    var_deduction = 0
    if total_count >= 5:
        # Calculate std dev
        variance = sum((r - avg_rating) ** 2 for r in ratings) / total_count
        std_dev = math.sqrt(variance)
        # If standard deviation is extremely low (meaning flat ratings) but average is extremely high, it's fake reviews!
        if std_dev < 0.3 and avg_rating >= 4.5:
            var_deduction = 15
        elif std_dev < 0.5 and avg_rating >= 4.2:
            var_deduction = 10
    else:
        # Low review sample size penalty
        var_deduction = 5

    # Deduct 4: Source monopoly (Max 20 pts)
    # If all reviews are from a single platform source
    source_deduction = 0
    if len(sources) <= 1 and total_count >= 5:
        source_deduction = 10

    # Calculate final trust score
    trust_score = 100 - (incon_deduction + susp_deduction + var_deduction + source_deduction)
    trust_score = max(0, min(100, trust_score))

    # Apply Trust Label categorization
    if trust_score >= 71:
        label = "Trusted"
        color = "green"
    elif trust_score >= 41:
        label = "Moderate"
        color = "yellow"
    else:
        label = "Suspicious"
        color = "red"

    return {
        "trust_score": trust_score,
        "trust_label": label,
        "trust_color": color,
        "risk_breakdown": {
            "sentiment_inconsistency": incon_deduction,
            "suspicious_ratio": susp_deduction,
            "variance_penalty": var_deduction,
            "source_monopoly": source_deduction
        }
    }

def Number_or_default(val):
    try:
        return float(val)
    except Exception:
        return 3
