from setuptools import setup, find_packages

setup(
    name="ucl-ml-engine",
    version="1.0.0",
    description="UEFA Champions League ML Prediction Engine",
    author="UCL Predictor Team",
    packages=find_packages(),
    install_requires=[
        'xgboost>=2.0.0',
        'scikit-learn>=1.4.0',
        'shap>=0.44.0',
        'pandas>=2.1.0',
        'numpy>=1.26.0',
        'scipy>=1.11.0',
        'joblib>=1.3.0',
        'python-dotenv>=1.0.0',
        'fastapi>=0.109.0',
        'uvicorn>=0.27.0',
        'pydantic>=2.5.0',
        'psycopg2-binary>=2.9.0',
    ],
    python_requires='>=3.9',
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
    ],
)
