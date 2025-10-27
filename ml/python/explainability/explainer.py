"""
SHAP-based Model Explainability
Provides feature contribution analysis for match predictions
"""

import shap
import numpy as np
from typing import Dict, List, Optional
import warnings
warnings.filterwarnings('ignore')

class MatchExplainer:
    """
    SHAP explainer for match outcome predictions
    Uses TreeExplainer for XGBoost models
    """
    
    def __init__(self, model):
        """
        Initialize explainer with trained model
        
        Args:
            model: Trained MatchOutcomePredictor instance
        """
        self.model = model
        self.explainer = None
        self.background_data = None
        
        if model.model is not None:
            self._initialize_explainer()
    
    def _initialize_explainer(self):
        """Initialize SHAP TreeExplainer"""
        try:
            # Use TreeExplainer for XGBoost
            self.explainer = shap.TreeExplainer(self.model.model)
            print("✅ SHAP explainer initialized")
        except Exception as e:
            print(f"⚠️  Warning: Could not initialize SHAP explainer: {e}")
            self.explainer = None
    
    def set_background_data(self, X: np.ndarray):
        """
        Set background data for SHAP calculations
        
        Args:
            X: Background dataset (n_samples, n_features)
        """
        self.background_data = self.model.scaler.transform(X)
        # Re-initialize explainer with background data
        if self.model.model is not None:
            self.explainer = shap.TreeExplainer(
                self.model.model,
                data=self.background_data
            )
    
    def explain_prediction(self, features: Dict) -> Dict[str, float]:
        """
        Get SHAP values for a single prediction
        
        Args:
            features: Dict of feature values
        
        Returns:
            Dict mapping feature names to SHAP values
        """
        if self.explainer is None:
            # Fallback to feature importance if SHAP not available
            return self._fallback_explanation(features)
        
        try:
            # Prepare features
            X = self.model.prepare_features(features)
            X_scaled = self.model.scaler.transform(X)
            
            # Calculate SHAP values
            shap_values = self.explainer.shap_values(X_scaled)
            
            # For multiclass, use values for predicted class
            if isinstance(shap_values, list):
                # Get predicted class
                pred_class = np.argmax(self.model.model.predict_proba(X_scaled)[0])
                shap_vals = shap_values[pred_class][0]
            else:
                shap_vals = shap_values[0]
            
            # Map to feature names
            explanation = {
                name: float(val)
                for name, val in zip(self.model.feature_names, shap_vals)
            }
            
            return explanation
        
        except Exception as e:
            print(f"⚠️  SHAP calculation failed: {e}")
            return self._fallback_explanation(features)
    
    def _fallback_explanation(self, features: Dict) -> Dict[str, float]:
        """
        Fallback explanation using feature importance
        when SHAP is not available
        """
        importance = self.model.get_feature_importance()
        
        # Scale by feature values
        explanation = {}
        for item in importance:
            feature_name = item['feature']
            feature_value = features.get(feature_name, 0)
            importance_score = item['importance']
            
            # Approximate contribution
            contribution = importance_score * (feature_value / 100)
            explanation[feature_name] = float(contribution)
        
        return explanation
    
    def get_feature_contributions(self, features: Dict) -> List[Dict]:
        """
        Get sorted list of feature contributions
        
        Returns:
            List of dicts with feature, value, contribution, impact
        """
        shap_values = self.explain_prediction(features)
        
        contributions = []
        for feature_name, shap_val in shap_values.items():
            feature_val = features.get(feature_name, 0)
            
            contributions.append({
                'feature': feature_name,
                'value': float(feature_val),
                'contribution': float(shap_val),
                'impact': 'positive' if shap_val > 0 else 'negative' if shap_val < 0 else 'neutral'
            })
        
        # Sort by absolute contribution
        contributions.sort(key=lambda x: abs(x['contribution']), reverse=True)
        
        return contributions
    
    def explain_top_factors(self, features: Dict, top_n: int = 5) -> Dict:
        """
        Get top positive and negative contributing factors
        
        Args:
            features: Feature dictionary
            top_n: Number of top factors to return
        
        Returns:
            Dict with 'positive' and 'negative' factor lists
        """
        contributions = self.get_feature_contributions(features)
        
        positive = [c for c in contributions if c['contribution'] > 0][:top_n]
        negative = [c for c in contributions if c['contribution'] < 0][:top_n]
        
        return {
            'positive': positive,
            'negative': negative
        }
    
    def generate_explanation_text(self, features: Dict) -> str:
        """
        Generate human-readable explanation
        
        Args:
            features: Feature dictionary
        
        Returns:
            Natural language explanation string
        """
        top_factors = self.explain_top_factors(features, top_n=3)
        
        positive_text = ", ".join([
            f"{f['feature']} ({f['contribution']:.3f})"
            for f in top_factors['positive']
        ])
        
        negative_text = ", ".join([
            f"{f['feature']} ({f['contribution']:.3f})"
            for f in top_factors['negative']
        ])
        
        explanation = (
            f"Key factors supporting the prediction: {positive_text}. "
            f"Factors working against it: {negative_text}."
        )
        
        return explanation


class PlayerExplainer:
    """
    SHAP explainer for player performance predictions
    """
    
    def __init__(self, model):
        self.model = model
        self.explainer = None
        
        if hasattr(model, 'model') and model.model is not None:
            self._initialize_explainer()
    
    def _initialize_explainer(self):
        """Initialize SHAP explainer"""
        try:
            self.explainer = shap.TreeExplainer(self.model.model)
            print("✅ Player SHAP explainer initialized")
        except Exception as e:
            print(f"⚠️  Warning: Could not initialize player explainer: {e}")
            self.explainer = None
    
    def explain_prediction(self, features: np.ndarray) -> np.ndarray:
        """
        Get SHAP values for player prediction
        
        Args:
            features: Feature array (1, n_features)
        
        Returns:
            SHAP values array
        """
        if self.explainer is None:
            return np.zeros(features.shape[1])
        
        try:
            shap_values = self.explainer.shap_values(features)
            return shap_values[0] if isinstance(shap_values, list) else shap_values
        except Exception as e:
            print(f"⚠️  SHAP calculation failed: {e}")
            return np.zeros(features.shape[1])


# Export main classes
__all__ = ['MatchExplainer', 'PlayerExplainer']
