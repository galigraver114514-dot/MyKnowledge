# Adaptive Recursive Problem-Solving Framework (v2)

## 0. Coupling Assessment

Before defining the objective, assess the degree of coupling between the problem's nodes.

Define the **coupling degree**:

\[
\kappa \in [0,1]
\]

where \(\kappa\) represents the extent to which the optimal solution of one node depends on the specific state or value of other nodes.

### 0.1 Operational Estimation of \(\kappa\)

\(\kappa\) must not remain a subjective label. Estimate it using the following test:

> **Swap Test**: For two candidate nodes \(A, B\), does reordering or independently varying one node change the evaluation outcome of the other?

- If independently varying \(A\) leaves \(B\)'s evaluation criteria unchanged → contributes to low \(\kappa\).
- If varying \(A\) changes what counts as a correct or good \(B\) → contributes to high \(\kappa\).

Secondary signals (used when the Swap Test is expensive to apply exhaustively):

- **Interface density**: number of shared state variables / constraints between nodes relative to total nodes.
- **Failure propagation history**: whether past failures in this problem class required revisiting multiple nodes simultaneously.

\(\kappa\) is a working estimate, not a precise measurement. It is only used to select an evaluation mode (§0, §4, §5), not as a scored output.

### Low Coupling — Low \(\kappa\)

Nodes are approximately independent and can be evaluated individually.

Examples:
- Function-level code refactoring
- Independent mathematical lemmas
- Isolated data-processing tasks

The original node-based framework applies directly.

### High Coupling — High \(\kappa\)

Nodes are strongly interdependent; their quality cannot be reliably evaluated in isolation.

Examples:
- System architecture trade-offs
- Complex software architecture
- Theme–plot interactions in writing
- Highly interconnected design problems

In this case:

- Nodes are not treated as independently evaluable units.
- Evaluation is performed on **node clusters** (mutually dependent groups).
- The Logic Chain evaluates whether nodes are mutually consistent under the overall objective, rather than whether one node merely produces the input required by another.

### 0.2 Re-Assessment Trigger

\(\kappa\) is not fixed after the initial assessment. It is re-evaluated whenever:

1. A node introduced during Brainstorm (§3) shares state or constraints with existing nodes in a way not accounted for in the initial estimate; or
2. A Dynamic Adjuster event (§6) reveals that a node presumed independent in fact depended on another node's value.

On re-assessment, if \(\kappa\) crosses the low/high threshold, the evaluation mode for all *unresolved* nodes switches accordingly. Already-verified low-coupling nodes are not retroactively invalidated unless the new dependency directly implicates them.

---

# 1. Background / Context

Identify the context and conditions in which the problem exists.

Determine:

- What is the current state?
- What are the relevant conditions and constraints?
- What information is known?
- What information is unknown?
- What assumptions are being made?
- What ambiguities need to be eliminated?

The purpose of this stage is to construct a sufficiently accurate representation of the problem before attempting to solve it.

The Context describes the **state of the problem**, not a prescribed solution. Where the environment can be inspected directly (files, logs, execution state, prior outputs), unknowns should be resolved by inspection rather than by assumption wherever inspection is available at low cost.

---

# 2. Objective

Define what needs to be achieved.

The objective must be considered from both the technical and practical perspectives.

### Technically

Determine:

- What needs to be solved at the underlying implementation or reasoning level?
- What mechanisms, structures, or processes are required?
- What constraints must the solution satisfy?

### Practically / Surface

Determine:

- What should the user ultimately experience?
- What should the external interface or observable result look like?
- What constitutes a practically successful outcome?

Technical and practical objectives must remain consistent with each other.

## 2.1 Versioned Objective

The objective is not necessarily immutable.

Represent the objective as:

\[
O_0 \rightarrow O_1 \rightarrow O_2 \rightarrow \cdots \rightarrow O_k
\]

where each \(O_i\) is a version of the objective established during the problem-solving process.

If exploration during Brainstorm or Logic Chain reveals that the original objective is incomplete or based on an invalid assumption, the framework triggers:

\[
O_i \rightarrow O_{i+1}
\]

This transition is recorded as part of the reasoning process, not silently substituted.

### Objective Update Trigger

An objective update is required when:

1. An unknown in the Context is resolved; and
2. The newly resolved information changes the feasibility, interpretation, constraints, or expected outcome of the current objective.

### 2.2 Cross-Recursion Objective Propagation

Because Subtasks (§8) apply this framework recursively, each Subtask maintains its own local objective sequence \(O_0' \rightarrow O_1' \rightarrow \cdots \rightarrow O_k'\), distinct from the parent's \(O_k\).

A child-level objective revision propagates to the parent under the following rule:

> If \(O_i' \rightarrow O_{i+1}'\) changes the Subtask's deliverable in a way that affects the parent node the Subtask was spawned to resolve, the parent's Objective Update Trigger (above) is evaluated using the revised Subtask deliverable as the new information.

If the parent's objective does not change under this evaluation, the child-level revision remains local. If it does change, the parent enters its own \(O_k \rightarrow O_{k+1}\) transition, and this propagates upward recursively under the same rule. A Subtask's objective revision is therefore never invisible to its parent; it is either explicitly absorbed or explicitly bounded as local.

---

# 3. Brainstorm / Nodes

For complex problems, identify the possible intermediate states or actions between the current Context and the Objective.

These intermediate elements are represented as **nodes**.

Nodes may be generated through:

- Forward reasoning from the current state;
- Backward reasoning from the desired outcome;
- Alternative solution paths;
- Identification of dependencies and constraints.

At this stage, possible nodes are not prematurely rejected. Each newly introduced node is checked against §0.2 (Re-Assessment Trigger) for its effect on \(\kappa\).

The purpose of Brainstorm is to establish the relevant solution space before committing to a particular Logic Chain.

For simple problems, this stage may be omitted.

---

# 4. Logic Chain

Construct the actual logical path from the current state toward the objective.

Each relevant node or node cluster is evaluated according to its actual relationship with the rest of the problem, using the current value of \(\kappa\) (§0, §0.2).

### Low Coupling

\[
A \rightarrow B
\]

Determine whether the output of \(A\) satisfies the input requirements of \(B\).

### High Coupling

Instead of evaluating nodes independently, determine whether:

\[
\{A,B,\ldots,N\}
\]

forms a mutually consistent configuration under the overall objective:

> **Are these nodes mutually constrained and collectively coherent with the objective?**

rather than merely:

> **Does node A produce the input required by node B?**

---

# 4.1 Node Evaluation

Each node is represented by:

\[
N_i=(v_i,c_i,s_i)
\]

where:

- \(v_i\) = expected value of executing or exploring the node;
- \(c_i\) = evaluation cost (computational, temporal, experimentation);
- \(s_i\) = side-effect / reversibility characteristic \(\in \{\text{reversible}, \text{irreversible}\}\).

### Execution Rule (corrected: conjunctive, irreversibility as hard veto)

\[
s_i = \text{irreversible} \;\Rightarrow\; \text{indirect validation required, regardless of } c_i
\]

\[
s_i = \text{reversible} \;\text{and}\; c_i \text{ low} \;\Rightarrow\; \text{execute first, evaluate after}
\]

\[
s_i = \text{reversible} \;\text{and}\; c_i \text{ high} \;\Rightarrow\; \text{indirect validation preferred, but direct execution permissible if no cheaper validation path exists}
\]

Irreversibility is a hard constraint, not interchangeable with low cost. A low-cost but irreversible action (e.g. sending a message, deleting a record) always requires indirect validation first.

Indirect validation methods:

- Simulation
- Read-only inspection
- Dry runs
- Static analysis
- Hypothetical reasoning
- Low-cost prototypes

---

# 5. Verification Frequency

Verification frequency is parameterized by \(f\).

### Per-Node Verification — \(f=\text{per-node}\)

Verify each node immediately after execution.

Appropriate for: low-\(\kappa\) problems, high-certainty problems, modular programming, deterministic transformations, tasks with stable local evaluation criteria.

Advantages: errors localized quickly; failed nodes easy to identify; errors do not propagate unchecked.

### Per-Chain Verification — \(f=\text{per-chain}\)

Execute a logically connected group of nodes and evaluate the resulting configuration as a whole.

Appropriate for: high-\(\kappa\) problems, exploratory problems, system design, complex architecture, writing and other tasks where local evaluation criteria are unstable.

In highly coupled systems, intermediate states may have little independent meaning; premature node-level verification can reject solutions that are only valid as a complete configuration.

\(f\) tracks \(\kappa\): a re-assessment of \(\kappa\) (§0.2) triggers re-selection of \(f\) for unresolved nodes.

---

# 6. Dynamic Adjuster

Handles failures occurring **during execution of the Logic Chain**.

Trigger condition:

> The current execution does not produce the expected result, or its output is incompatible with the requirements of a subsequent node.

Example: \(A \rightarrow B\) was expected; execution produces \(A \rightarrow X\), where \(X\) cannot satisfy \(B\)'s requirements.

Procedure:

1. Identify the detected gap.
2. Determine the node or assumption responsible.
3. Check whether the failure implies a \(\kappa\) re-assessment (§0.2).
4. Feed the failure back into the relevant stage.
5. Modify, replace, or introduce nodes as necessary.
6. Re-enter the problem-solving process from the appropriate point.

A failed Logic Chain is not forced to continue unchanged.

---

# 7. Refine

Occurs **after the Logic Chain has completed**.

The resulting state is compared against the current objective version:

\[
Result \quad vs. \quad O_k
\]

\[
Gap = 0 \;\Rightarrow\; \text{problem solved}
\]

\[
Gap \neq 0 \;\Rightarrow\; \text{unresolved difference becomes a new problem}
\]

---

# 7.1 Unified Gap Detection

Dynamic Adjuster and Refine are both instances of:

\[
\text{Gap Detection} \rightarrow \text{Feedback} \rightarrow \text{Re-entry}
\]

distinguished only by timing:

\[
\text{Execution Gap (during)} \rightarrow \text{Dynamic Adjuster}
\]
\[
\text{Objective Gap (after)} \rightarrow \text{Refine}
\]

A single Gap Detection mechanism routes its output to the appropriate re-entry point according to when and where the gap was detected.

---

# 8. Subtask

If Refine identifies an unresolved problem, create it as a **Subtask**.

A Subtask is an independent problem within the larger problem, retaining its relationship to the parent objective via §2.2 (Cross-Recursion Objective Propagation).

\[
Problem \rightarrow Subtask_A \rightarrow Subtask_{A1} \rightarrow Subtask_{A1a}
\]

The same framework, including §0–§7.1, applies recursively at each level. Each level maintains its own \(\kappa\), \(f\), \((v,c,s)\), and \(O_i\)-sequence; only objective revisions propagate upward (§2.2), and only when they affect the parent node.

---

# 9. Overall Architecture

```text
Context
   ↓
Coupling Assessment (κ) ←──────────────┐
   ↓                                   │
Objective O₀ ←──────────────┐          │ κ re-assessment
   ↓                        │          │ (new node changes
Brainstorm / Nodes ─────────┘          │  dependency structure,
   ↓  (new node → check κ)─────────────┘  or Adjuster reveals
   ↓                                       hidden coupling)
Logic Chain (mode set by κ)
   ↓
Execution + Verification (frequency set by f)
   │
   ├── Gap detected during execution
   │        ↓
   │   Dynamic Adjuster → κ re-check → re-enter relevant stage
   │
   └── Logic Chain completed
            ↓
          Refine
            ↓
       Compare with Oₖ
            │
       ┌────┴────┐
       ↓         ↓
    Gap = 0    Gap ≠ 0
       ↓         ↓
     Done      Subtask (own κ, f, O′; revisions propagate per §2.2)
                 ↓
              Repeat
```

Adaptive parameters:

\[
\boxed{\kappa,\quad f,\quad (v,c,s)}
\]

Objective sequence:

\[
\boxed{O_0 \rightarrow O_1 \rightarrow \cdots \rightarrow O_k}
\]

**General re-evaluation rule** (applies uniformly to \(\kappa\), \(O_i\), and \((v,c,s)\)): any parameter is re-evaluated whenever new evidence contradicts the assumption under which it was last set. No parameter is privileged as revisable while others are treated as fixed.

---

# 10. Core Principle

The framework does not replace its recursive structure according to problem type. It preserves one architecture while making previously implicit assumptions explicit, adjustable, and — per §9's general re-evaluation rule — continuously revisable rather than fixed at first assignment.

The original linear framework is recovered as the special case:

\[
\kappa \approx 0, \quad O = \text{constant}, \quad c \approx 0,\; s = \text{reversible}, \quad f=\text{per-node}
\]

corresponding to highly structured engineering, programming, and mathematical problems.

For highly coupled, exploratory problems, the framework shifts toward:

\[
\kappa \rightarrow 1, \quad O_0 \rightarrow O_1 \rightarrow \cdots, \quad c \text{ high},\; s \text{ potentially irreversible}, \quad f=\text{per-chain}
\]

with node-cluster evaluation, objective revision (with upward propagation across recursion levels, §2.2), indirect validation gated by irreversibility rather than cost, and holistic verification.

The problem's own structural characteristics determine how the framework operates; no external decision of "should this framework apply" is required.

Core architecture:

\[
\boxed{
Context
\rightarrow
Objective
\rightarrow
Brainstorm
\rightarrow
Logic\ Chain
\rightarrow
Dynamic\ Adjuster
\rightarrow
Refine
\rightarrow
Subtask
}
\]

## 10.1 Known Open Limitation

This framework is a logical design and has not been empirically validated against benchmarks (e.g. HotpotQA, GSM8K, WebShop) or compared quantitatively to LATS, ToT, or GoT on task success rate, token cost, or latency. Structural completeness is not evidence of superior performance. The added machinery in v2 (κ operational estimation, objective propagation, corrected execution rule) increases per-step overhead; whether this overhead is offset by improved outcomes is an empirical question this document does not answer.
