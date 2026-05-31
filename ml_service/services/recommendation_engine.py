def get_jaccard_overlap(list1, list2):
    if not list1 or not list2:
        return 0.0
    set1, set2 = set(list1), set(list2)
    intersection = set1.intersection(set2)
    union = set1.union(set2)
    return len(intersection) / len(union) if union else 0.0

def get_recommendations(target_product, all_products):
    """
    Computes a sorted list of recommendations for a target product based on weighted scores:
    - 40% Category Similarity
    - 30% Keyword Jaccard Overlap
    - 20% Trust Index
    - 10% Rating Value
    """
    recommendations = []
    
    target_id = target_product.get("id")
    target_category = target_product.get("category", "")
    target_keywords = target_product.get("keywords", [])
    if isinstance(target_keywords, str):
        try:
            import json
            target_keywords = json.loads(target_keywords)
        except Exception:
            target_keywords = []

    for prod in all_products:
        p_id = prod.get("id")
        if p_id == target_id:
            continue # Skip target product itself

        p_category = prod.get("category", "")
        p_rating = float(prod.get("rating", 4.0))
        p_trust = int(prod.get("trust_score", 80))
        p_keywords = prod.get("keywords", [])
        if isinstance(p_keywords, str):
            try:
                import json
                p_keywords = json.loads(p_keywords)
            except Exception:
                p_keywords = []

        # 1. Category similarity (40 pts)
        cat_score = 40.0 if p_category.lower() == target_category.lower() else 0.0

        # 2. Keyword Jaccard overlap (30 pts)
        overlap = get_jaccard_overlap(target_keywords, p_keywords)
        kw_score = overlap * 30.0

        # 3. Trust Index score (20 pts)
        trust_score = (p_trust / 100.0) * 20.0

        # 4. Rating score (10 pts)
        rating_score = (p_rating / 5.0) * 10.0

        # Sum total match score
        total_score = cat_score + kw_score + trust_score + rating_score
        match_percent = int(round(total_score))

        # Generate descriptive reasoning explanation
        explanation = f"Matches {int(cat_score)}% category similarity and {int(round(overlap * 100))}% keyword overlap, backed by a '{p_trust}' trust index score."

        recommendations.append({
            "id": p_id,
            "title": prod.get("title") or prod.get("name"),
            "name": prod.get("title") or prod.get("name"),
            "category": p_category,
            "price": float(prod.get("price", 9.99)),
            "rating": p_rating,
            "thumbnail": prod.get("thumbnail"),
            "image_url": prod.get("thumbnail"),
            "trust_score": p_trust,
            "match_score": match_percent,
            "keywords": p_keywords,
            "explanation": explanation
        })

    # Sort recommendations descending by match_score
    recommendations.sort(key=lambda x: x["match_score"], reverse=True)
    return recommendations
