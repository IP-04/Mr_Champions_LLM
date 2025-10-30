"""
Quick Start Script for UCL ML Server
=====================================

This script:
1. Trains all ML models
2. Saves them to disk
3. Starts the FastAPI server

Usage:
    python quickstart.py

Or to just train models:
    python quickstart.py --train-only

Or to just start server (assumes models exist):
    python quickstart.py --serve-only
"""

import argparse
import os
import sys

def train_all_models(n_samples=1000):
    """Train all ML models"""
    print("\n" + "="*60)
    print("🏋️  TRAINING ML MODELS")
    print("="*60 + "\n")
    
    from train import train_match_outcome_model, train_xg_models
    
    # Create output directory
    os.makedirs('models/trained', exist_ok=True)
    
    # Train match outcome model
    print("\n📊 Step 1/2: Training Match Outcome Model...")
    match_model, match_metrics = train_match_outcome_model(
        n_samples=n_samples,
        save_path='models/trained/match_outcome_model.pkl'
    )
    print(f"✅ Match model trained - Accuracy: {match_metrics['val_accuracy']:.2%}")
    
    # Train xG models
    print("\n📊 Step 2/2: Training Expected Goals Models...")
    xg_home, xg_away, metrics_home, metrics_away = train_xg_models(
        n_samples=n_samples,
        save_path_home='models/trained/xg_home_model.pkl',
        save_path_away='models/trained/xg_away_model.pkl'
    )
    print(f"✅ xG models trained - Home RMSE: {metrics_home['rmse']:.4f}, Away RMSE: {metrics_away['rmse']:.4f}")
    
    print("\n" + "="*60)
    print("✅ ALL MODELS TRAINED SUCCESSFULLY!")
    print("="*60)
    print(f"\n📁 Models saved to: models/trained/")
    print(f"   - match_outcome_model.pkl")
    print(f"   - xg_home_model.pkl")
    print(f"   - xg_away_model.pkl")
    

def start_server(host="127.0.0.1", port=8000):
    """Start FastAPI ML server"""
    import uvicorn
    
    # Check if models exist
    required_models = [
        'models/trained/match_outcome_model.pkl',
        'models/trained/xg_home_model.pkl',
        'models/trained/xg_away_model.pkl'
    ]
    
    missing_models = [m for m in required_models if not os.path.exists(m)]
    
    if missing_models:
        print("\n❌ ERROR: Missing trained models!")
        print("\nMissing files:")
        for model in missing_models:
            print(f"  - {model}")
        print("\nRun training first:")
        print("  python quickstart.py --train-only")
        sys.exit(1)
    
    print("\n" + "="*60)
    print("🚀 STARTING ML API SERVER")
    print("="*60 + "\n")
    print(f"📡 Server URL:     http://localhost:{port}")
    print(f"📄 API Docs:       http://localhost:{port}/docs")
    print(f"🔍 Health Check:   http://localhost:{port}/health")
    print("\n💡 Press CTRL+C to stop the server\n")
    
    # Start uvicorn server
    uvicorn.run(
        "serve:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )


def main():
    parser = argparse.ArgumentParser(
        description='UCL ML Server Quick Start',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Train models and start server
  python quickstart.py
  
  # Only train models
  python quickstart.py --train-only
  
  # Only start server (models must exist)
  python quickstart.py --serve-only
  
  # Custom training samples
  python quickstart.py --train-only --samples 2000
  
  # Custom server port
  python quickstart.py --serve-only --port 8080
        """
    )
    
    parser.add_argument(
        '--train-only',
        action='store_true',
        help='Only train models, do not start server'
    )
    
    parser.add_argument(
        '--serve-only',
        action='store_true',
        help='Only start server, do not train models'
    )
    
    parser.add_argument(
        '--samples',
        type=int,
        default=1000,
        help='Number of training samples (default: 1000)'
    )
    
    parser.add_argument(
        '--port',
        type=int,
        default=8000,
        help='Server port (default: 8000)'
    )
    
    parser.add_argument(
        '--host',
        type=str,
        default='0.0.0.0',
        help='Server host (default: 0.0.0.0)'
    )
    
    args = parser.parse_args()
    
    print("\n⚽ UCL ML PREDICTION SERVER - QUICK START")
    print("="*60)
    
    # Determine what to do
    if args.train_only and args.serve_only:
        print("❌ ERROR: Cannot use both --train-only and --serve-only")
        sys.exit(1)
    
    if args.serve_only:
        # Only start server
        start_server(host=args.host, port=args.port)
    
    elif args.train_only:
        # Only train models
        train_all_models(n_samples=args.samples)
    
    else:
        # Default: train then serve
        train_all_models(n_samples=args.samples)
        
        print("\n" + "="*60)
        input("\n✅ Training complete! Press ENTER to start the server...")
        
        start_server(host=args.host, port=args.port)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
