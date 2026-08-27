// ==========================================
// 1. ESTADO E PERSISTÊNCIA DE DADOS
// ==========================================
let inventory = JSON.parse(localStorage.getItem('choco_prec_inventory')) || [
  { id: 1, sku: 'MAT-001', name: 'Cacau em Pó 70%', category: 'Matéria-Prima', qty: 15.5, minQty: 10.0, unit: 'Kg', cost: 40.00, batch: 'LT-2026-A1', exp: '2026-11-20', location: 'Depósito A' },
  { id: 2, sku: 'MAT-002', name: 'Manteiga de Cacau', category: 'Matéria-Prima', qty: 3.2, minQty: 5.0, unit: 'Kg', cost: 65.00, batch: 'LT-2026-B2', exp: '2026-09-15', location: 'Câmara Fria' }
];

let recipes = JSON.parse(localStorage.getItem('choco_prec_recipes')) || [
  {
    id: 101,
    name: 'Barra de Chocolate 70% (100g)',
    yieldQty: 10,
    lossPercent: 3.0,
    ingredients: [
      { inventoryId: 1, qty: 0.700 },
      { inventoryId: 2, qty: 0.350 }
    ]
  }
];

let solicitacoes = JSON.parse(localStorage.getItem('choco_prec_solicitacoes')) || [];
let stockChartInstance = null;

function saveData() {
  localStorage.setItem('choco_prec_inventory', JSON.stringify(inventory));
  localStorage.setItem('choco_prec_recipes', JSON.stringify(recipes));
  localStorage.setItem('choco_prec_solicitacoes', JSON.stringify(solicitacoes));
  renderAll();
}

// ==========================================
// 2. NAVEGAÇÃO E MODAIS
// ==========================================
document.querySelectorAll('#mainMenu a').forEach(link => {
  link.addEventListener('click', (e) => {
    const targetPage = e.target.getAttribute('data-page');
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#mainMenu a').forEach(a => a.classList.remove('active'));
    document.getElementById(targetPage).classList.add('active');
    e.target.classList.add('active');
    
    // Atualiza o título dinamicamente
    document.getElementById('currentPageTitle').innerText = e.target.innerText.replace(/[^\w\sÀ-ú]/gi, '').trim();
  });
});

function openModal(id) {
  if (id === 'recipeModal') {
    document.getElementById('recipeIngredientsTable').innerHTML = '';
    addIngredientRow();
  }
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ==========================================
// 3. LÓGICA DE FICHA TÉCNICA DINÂMICA
// ==========================================
function addIngredientRow(selectedId = '', qty = '') {
  const tbody = document.getElementById('recipeIngredientsTable');
  const rowId = Date.now() + Math.random();
  
  const options = inventory.map(item => 
    `<option value="${item.id}" data-cost="${item.cost}" data-unit="${item.unit}" ${item.id == selectedId ? 'selected' : ''}>
      ${item.name} (R$ ${item.cost.toFixed(2)} / ${item.unit})
    </option>`
  ).join('');

  const tr = document.createElement('tr');
  tr.id = `row-${rowId}`;
  tr.innerHTML = `
    <td>
      <select class="recipe-ing-select" onchange="calculateRecipeCost()" required style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
        <option value="">Selecione um insumo...</option>
        ${options}
      </select>
    </td>
    <td>
      <input type="number" class="recipe-ing-qty" step="0.001" min="0.001" value="${qty}" placeholder="Qtd" oninput="calculateRecipeCost()" required style="width:100%; padding:6px; border-radius:6px; border:1px solid var(--border);">
    </td>
    <td>
      <button type="button" class="btn btn-danger" style="padding: 4px 8px; font-size:0.75rem;" onclick="removeIngredientRow('row-${rowId}')">Remover</button>
    </td>
  `;
  tbody.appendChild(tr);
  calculateRecipeCost();
}

function removeIngredientRow(rowId) {
  document.getElementById(rowId).remove();
  calculateRecipeCost();
}

function calculateRecipeCost() {
  const yieldQty = parseFloat(document.getElementById('recipeYieldQty').value) || 0;
  const lossPercent = parseFloat(document.getElementById('recipeLoss').value) || 0;
  const rows = document.querySelectorAll('#recipeIngredientsTable tr');
  let totalBatchCost = 0;

  rows.forEach(row => {
    const select = row.querySelector('.recipe-ing-select');
    const qtyInput = row.querySelector('.recipe-ing-qty');
    
    if (select && select.value && qtyInput && qtyInput.value) {
      const selectedOption = select.options[select.selectedIndex];
      const costPerUnit = parseFloat(selectedOption.getAttribute('data-cost')) || 0;
      const qtyRequired = parseFloat(qtyInput.value) || 0;
      totalBatchCost += costPerUnit * qtyRequired;
    }
  });

  totalBatchCost = totalBatchCost * (1 + (lossPercent / 100));

  if (yieldQty > 0) {
    const unitCost = totalBatchCost / yieldQty;
    document.getElementById('recipeUnitCostDisplay').value = `R$ ${unitCost.toFixed(2)} / un`;
  } else {
    document.getElementById('recipeUnitCostDisplay').value = 'R$ 0,00';
  }
}

function calcTotal() {
  const qtd = parseFloat(document.getElementById('solQtd').value) || 0;
  const unit = parseFloat(document.getElementById('solValorUnit').value) || 0;
  document.getElementById('solValorTotal').value = (qtd * unit).toFixed(2);
}

// ==========================================
// 4. EVENTOS DE FORMULÁRIOS
// ==========================================
document.getElementById('formItem').addEventListener('submit', (e) => {
  e.preventDefault();
  inventory.push({
    id: Date.now(),
    sku: document.getElementById('itemSku').value,
    name: document.getElementById('itemName').value,
    category: document.getElementById('itemCategory').value,
    unit: document.getElementById('itemUnit').value,
    cost: parseFloat(document.getElementById('itemCost').value),
    qty: parseFloat(document.getElementById('itemQty').value),
    minQty: parseFloat(document.getElementById('itemMinQty').value),
    batch: document.getElementById('itemBatch').value,
    exp: document.getElementById('itemExp').value,
    location: document.getElementById('itemLocation').value
  });
  closeModal('itemModal');
  e.target.reset();
  saveData();
});

document.getElementById('formRecipe').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const rows = document.querySelectorAll('#recipeIngredientsTable tr');
  const ingredientsList = [];

  rows.forEach(row => {
    const select = row.querySelector('.recipe-ing-select');
    const qtyInput = row.querySelector('.recipe-ing-qty');
    if (select.value && qtyInput.value) {
      ingredientsList.push({
        inventoryId: parseInt(select.value),
        qty: parseFloat(qtyInput.value)
      });
    }
  });

  recipes.push({
    id: Date.now(),
    name: document.getElementById('recipeName').value,
    yieldQty: parseInt(document.getElementById('recipeYieldQty').value),
    lossPercent: parseFloat(document.getElementById('recipeLoss').value) || 0,
    ingredients: ingredientsList
  });

  closeModal('recipeModal');
  e.target.reset();
  saveData();
});

document.getElementById('formSolicitation').addEventListener('submit', (e) => {
  e.preventDefault();
  const qtd = parseFloat(document.getElementById('solQtd').value);
  const unitVal = parseFloat(document.getElementById('solValorUnit').value);
  solicitacoes.push({
    id: Date.now(),
    protocol: `SOL-2026-${solicitacoes.length + 101}`,
    solicitante: document.getElementById('solSolicitante').value,
    setor: document.getElementById('solSetor').value,
    dataNecessaria: document.getElementById('solDataNecessaria').value,
    item: document.getElementById('solItem').value,
    qty: qtd,
    totalVal: (qtd * unitVal).toFixed(2),
    status: 'Pendente'
  });
  closeModal('solicitationModal');
  e.target.reset();
  saveData();
});

// ==========================================
// 5. FABRICAÇÃO E EXCLUSÃO
// ==========================================
function executeProduction(recipeId) {
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) return;

  let hasStock = true;
  let missingItemName = '';

  recipe.ingredients.forEach(ing => {
    const item = inventory.find(i => i.id === ing.inventoryId);
    if (!item || item.qty < ing.qty) {
      hasStock = false;
      missingItemName = item ? item.name : 'Insumo não encontrado';
    }
  });

  if (!hasStock) {
    alert(`PRODUÇÃO INTERROMPIDA: Saldo insuficiente para: ${missingItemName}`);
    return;
  }

  recipe.ingredients.forEach(ing => {
    const item = inventory.find(i => i.id === ing.inventoryId);
    if (item) {
      item.qty = parseFloat((item.qty - ing.qty).toFixed(3));
    }
  });

  alert(`Sucesso! Lote de "${recipe.name}" produzido. Todos os insumos foram abatidos do estoque.`);
  saveData();
}

function deleteItem(id) {
  inventory = inventory.filter(i => i.id !== id);
  saveData();
}

// ==========================================
// 6. RENDERIZAÇÃO E DASHBOARD
// ==========================================
function renderAll() {
  const criticalItems = inventory.filter(i => i.qty <= i.minQty);
  const pendingSol = solicitacoes.filter(s => s.status === 'Pendente').length;

  document.getElementById('kpi-critical').innerText = criticalItems.length;
  document.getElementById('kpi-total-items').innerText = inventory.length;
  document.getElementById('kpi-total-recipes').innerText = recipes.length;
  if (document.getElementById('kpi-pending-sol')) {
    document.getElementById('kpi-pending-sol').innerText = pendingSol;
  }

  // Renderizar Alertas Críticos no Dashboard
  const alertsList = document.getElementById('dashboard-alerts-list');
  if (alertsList) {
    if (criticalItems.length === 0) {
      alertsList.innerHTML = `<li style="color: var(--success); font-size: 0.9rem;">✅ Todos os insumos estão em níveis seguros!</li>`;
    } else {
      alertsList.innerHTML = criticalItems.map(item => `
        <li class="alert-item">
          <div>
            <strong>${item.name}</strong><br>
            <small>Lote: ${item.batch}</small>
          </div>
          <span>${item.qty} / ${item.minQty} ${item.unit}</span>
        </li>
      `).join('');
    }
  }

  renderDashboardChart();
  renderTables();
}

function renderDashboardChart() {
  const ctx = document.getElementById('stockChart');
  if (!ctx) return;

  const labels = inventory.map(i => i.name);
  const currentQty = inventory.map(i => i.qty);
  const minQty = inventory.map(i => i.minQty);

  if (stockChartInstance) {
    stockChartInstance.destroy();
  }

  stockChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Estoque Atual',
          data: currentQty,
          backgroundColor: '#4a2810',
          borderRadius: 6
        },
        {
          label: 'Estoque Mínimo',
          data: minQty,
          backgroundColor: '#d4a359',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderTables() {
  document.getElementById('table-estoque').innerHTML = inventory.map(i => {
    const isCritical = i.qty <= i.minQty;
    return `
      <tr>
        <td><strong>${i.sku}</strong><br><small>${i.name}</small></td>
        <td>${i.category}</td>
        <td><strong>${i.qty} ${i.unit}</strong></td>
        <td>${i.minQty} ${i.unit}</td>
        <td>${i.batch}</td>
        <td>${i.exp}</td>
        <td><span class="badge ${isCritical ? 'badge-critical' : 'badge-ok'}">${isCritical ? 'Estoque Baixo' : 'Normal'}</span></td>
        <td><button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteItem(${i.id})">Excluir</button></td>
      </tr>
    `;
  }).join('');

  document.getElementById('table-receitas').innerHTML = recipes.map(r => {
    const ingredientsSummary = r.ingredients.map(ing => {
      const item = inventory.find(i => i.id === ing.inventoryId);
      return item ? `${ing.qty} ${item.unit} de ${item.name}` : 'Insumo Indefinido';
    }).join('<br>');

    return `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td>${r.yieldQty} un (Perda: ${r.lossPercent}%)</td>
        <td><small>${ingredientsSummary}</small></td>
        <td>
          <button class="btn" style="padding:4px 8px; font-size:0.75rem;" onclick="executeProduction(${r.id})">
            🏭 Fabricar Lote
          </button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('table-solicitacoes').innerHTML = solicitacoes.map(s => `
    <tr>
      <td><strong>${s.protocol}</strong></td>
      <td>${s.solicitante}<br><small style="color:var(--text-muted);">${s.setor}</small></td>
      <td>${s.item}</td>
      <td>${s.qty}</td>
      <td>R$ ${s.totalVal}</td>
      <td><span class="badge badge-alert">${s.status}</span></td>
    </tr>
  `).join('');
}

// Inicialização
renderAll();