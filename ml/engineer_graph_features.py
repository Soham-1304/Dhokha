import pandas as pd
import networkx as nx
import sqlite3
import time

def build_graph_and_export_profiles(csv_path="paysim_enhanced.csv", db_path="network_profiles.db"):
    print(f"🚀 Loading transaction dataset from: {csv_path}...")
    start_time = time.time()
    
    # 1. Load Transaction Data
    df = pd.read_csv(csv_path)
    print(f"📊 Loaded {len(df):,} transactions successfully.")
    
    # 2. Build the Directed Graph
    print("🕸️ Building network graph from transaction history...")
    # Group by sender -> receiver to establish directional money flow edges
    edges = df.groupby(['nameOrig', 'nameDest']).size().reset_index(name='weight')
    
    G = nx.from_pandas_edgelist(
        edges, 
        source='nameOrig', 
        target='nameDest', 
        edge_attr='weight', 
        create_using=nx.DiGraph()
    )
    print(f"✅ Graph constructed with {G.number_of_nodes():,} nodes and {G.number_of_edges():,} edges.")
    
    # 3. Calculate Graph Metrics
    print("⚡ Computing PageRank scores (structural network risk weights)...")
    pagerank_scores = nx.pagerank(G, alpha=0.85)
    
    print("⚡ Calculating In-Degree and Out-Degree metrics...")
    in_degrees = dict(G.in_degree())
    out_degrees = dict(G.out_degree())
    
    # Identify Merchant Accounts (Accounts starting with 'M')
    all_nodes = list(G.nodes())
    
    # 4. Assemble the Profile DataFrame
    print("📦 Assembling account profile lookup table...")
    profiles_df = pd.DataFrame({
        'account_id': all_nodes,
        'dest_in_degree': [float(in_degrees.get(node, 0)) for node in all_nodes],
        'dest_out_degree': [float(out_degrees.get(node, 0)) for node in all_nodes],
        'dest_pagerank': [float(pagerank_scores.get(node, 0.0)) for node in all_nodes],
        'is_merchant': [1 if str(node).startswith('M') else 0 for node in all_nodes]
    })
    
    # 5. Export to SQLite Database for Backend Queries
    print(f"💾 Saving profile table to SQLite Database: {db_path}...")
    conn = sqlite3.connect(db_path)
    
    # Save table
    profiles_df.to_sql("account_profiles", conn, if_exists="replace", index=False)
    
    # Create an Index on account_id for lightning-fast O(1) lookups
    conn.execute("CREATE INDEX IF NOT EXISTS idx_account_id ON account_profiles (account_id);")
    conn.commit()
    conn.close()
    
    elapsed = time.time() - start_time
    print(f"🎉 SUCCESS! Profile lookup table generated in {elapsed:.2f} seconds.")
    print(f"💡 Table 'account_profiles' is indexed and ready for backend O(1) query lookups.")

if __name__ == "__main__":
    build_graph_and_export_profiles()