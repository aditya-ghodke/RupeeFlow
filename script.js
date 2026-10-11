"use strict";

const STORAGE_KEY = "rupeeflow_data_v1";
const CATEGORIES = {
  expense: ["Food & Dining","Transport","Shopping","Bills & Utilities","Housing","Health","Education","Entertainment","Travel","Personal Care","Subscriptions","Other"],
  income: ["Salary","Freelance","Business","Investment","Gift","Other Income"]
};
const COLORS = ["#5de0ac","#a995ff","#ff9b87","#70b9ff","#ffd36e","#ff82ac","#73d5d0","#b6c2d6"];
const $ = id => document.getElementById(id);
const today = new Date();
const monthKey = date => String(date).slice(0,7);
const currentMonth = () => `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
const dateString = () => `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
const money = value => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(value)||0);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const uid = () => globalThis.crypto?.randomUUID ? crypto.randomUUID() : `rf_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

function blankData(){return {transactions:[],budget:0,goal:{name:"My savings goal",target:0,saved:0},budgets:{}}}
function normalizeData(raw){
  const base=blankData();
  if(!raw || typeof raw!=="object") return base;
  const tx=Array.isArray(raw.transactions)?raw.transactions:[];
  base.transactions=tx.filter(t=>t&&typeof t==="object").map(t=>({
    id:String(t.id||uid()),title:String(t.title||t.description||"Untitled transaction").slice(0,90),
    amount:Math.max(0,Number(t.amount)||0),date:/^\d{4}-\d{2}-\d{2}$/.test(String(t.date||""))?String(t.date):dateString(),
    type:t.type==="income"?"income":"expense",category:String(t.category||(t.type==="income"?"Other Income":"Other")),
    note:String(t.note||"").slice(0,160),createdAt:t.createdAt||new Date().toISOString()
  }));
  base.budget=Math.max(0,Number(raw.budget)||0);
  if(raw.budgets&&typeof raw.budgets==="object") base.budgets=raw.budgets;
  const g=raw.goal&&typeof raw.goal==="object"?raw.goal:{};
  base.goal={name:String(g.name||"My savings goal").slice(0,70),target:Math.max(0,Number(g.target)||0),saved:Math.max(0,Number(g.saved)||0)};
  return base;
}
function loadData(){
  try { const raw=localStorage.getItem(STORAGE_KEY); return raw?normalizeData(JSON.parse(raw)):blankData(); }
  catch(error){console.error("Could not read RupeeFlow data",error);return blankData();}
}
let data=loadData();
let toastTimer;
function saveData(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true;}
  catch(error){notify("Could not save data. Browser storage may be full or unavailable.",true);console.error(error);return false;}
}
function notify(message,isError=false){
  const el=$("toast");el.textContent=message;el.classList.toggle("error",isError);el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
}
function total(items,type){return items.filter(t=>!type||t.type===type).reduce((sum,t)=>sum+t.amount,0)}
function monthTransactions(month){return data.transactions.filter(t=>monthKey(t.date)===month)}
function monthTotals(month){const list=monthTransactions(month);return {income:total(list,"income"),expense:total(list,"expense"),count:list.length}}
function sortedTransactions(items){return [...items].sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)))}
function categoryTotals(items,type="expense"){
  const result={};items.filter(t=>t.type===type).forEach(t=>result[t.category]=(result[t.category]||0)+t.amount);
  return Object.entries(result).sort((a,b)=>b[1]-a[1]);
}
function fmtDate(date){if(!date)return "";const d=new Date(`${date}T12:00:00`);return Number.isNaN(d.getTime())?date:d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
function monthLabel(month){const d=new Date(`${month}-01T12:00:00`);return d.toLocaleDateString("en-IN",{month:"short"})}
function symbolFor(category){const icons={"Food & Dining":"🍽","Transport":"↗","Shopping":"◇","Bills & Utilities":"ϟ","Housing":"⌂","Health":"＋","Education":"▤","Entertainment":"♫","Travel":"✈","Personal Care":"✳","Subscriptions":"↻","Salary":"₹","Freelance":"✦","Business":"▥","Investment":"↗","Gift":"♡"};return icons[category]||"•"}

function render(){
  const month=$("monthPicker").value||currentMonth();
  const totals=monthTotals(month);
  $("balanceValue").textContent=money(total(data.transactions,"income")-total(data.transactions,"expense"));
  $("incomeValue").textContent=money(totals.income);
  $("expenseValue").textContent=money(totals.expense);
  $("savingsValue").textContent=money(totals.income-totals.expense);
  $("savingsFoot").textContent=totals.income>0?`${Math.round((totals.income-totals.expense)/totals.income*100)}% savings rate`:"Income minus expenses";
  renderCashFlow();renderBudget(month,totals);renderTopCategories(month);renderRecent(month);
  renderTransactionTable();renderAnalytics();renderPlanning(month,totals);
}
function renderCashFlow(){
  const months=[];
  for(let i=5;i>=0;i--){const d=new Date(`${$("monthPicker").value||currentMonth()}-01T12:00:00`);d.setMonth(d.getMonth()-i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;months.push({key,...monthTotals(key)});}
  const max=Math.max(1,...months.flatMap(m=>[m.income,m.expense]));
  $("cashFlowChart").innerHTML=months.map(m=>`<div class="chart-month"><div class="bar-pair" title="${escapeHtml(m.key)}"><div class="bar income" style="height:${Math.max(m.income?3:0,m.income/max*100)}%" title="Income ${escapeHtml(money(m.income))}"></div><div class="bar expense" style="height:${Math.max(m.expense?3:0,m.expense/max*100)}%" title="Expenses ${escapeHtml(money(m.expense))}"></div></div><small>${escapeHtml(monthLabel(m.key))}</small></div>`).join("");
}
function renderBudget(month,totals){
  const spent=totals.expense,budget=data.budget,percent=budget>0?spent/budget*100:0,left=budget-spent;
  $("budgetSpent").textContent=money(spent);
  $("budgetCaption").textContent=budget>0?`of ${money(budget)} monthly budget`:"spent this month";
  $("budgetProgress").style.width=`${Math.min(100,percent)}%`;
  $("budgetProgress").classList.toggle("over",percent>100);
  $("budgetLeft").textContent=budget>0?(left>=0?`${money(left)} remaining`:`${money(-left)} over budget`):"Set a monthly budget";
  $("budgetPercent").textContent=budget>0?`${Math.round(percent)}%`:"—";
}
function renderTopCategories(month){
  const cats=categoryTotals(monthTransactions(month));const max=cats[0]?.[1]||1;
  $("topCategories").innerHTML=cats.length?cats.slice(0,4).map(([name,amount])=>`<div class="category-item"><span class="category-name">${escapeHtml(name)}</span><span class="category-amount">${money(amount)}</span><div class="category-track"><span style="width:${amount/max*100}%"></span></div></div>`).join(""):'<p class="no-data">No expenses recorded for this month yet.</p>';
}
function renderRecent(month){
  const list=sortedTransactions(monthTransactions(month)).slice(0,5);
  $("recentTransactions").innerHTML=list.length?list.map(t=>`<div class="transaction-row"><div class="transaction-main"><span class="transaction-symbol ${t.type}">${escapeHtml(symbolFor(t.category))}</span><div><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.category)} · ${escapeHtml(fmtDate(t.date))}</small></div></div><span></span><span class="transaction-amount ${t.type==="income"?"positive":"negative"}">${t.type==="income"?"+":"−"}${money(t.amount)}</span></div>`).join(""):'<div class="no-data">Nothing here yet. Add a transaction to get started.</div>';
}
function filteredTransactions(){
  const query=$("searchInput").value.trim().toLowerCase(),type=$("typeFilter").value,category=$("categoryFilter").value,month=$("dateFilter").value;
  return sortedTransactions(data.transactions).filter(t=>(!query||`${t.title} ${t.category} ${t.note||""}`.toLowerCase().includes(query))&&(type==="all"||t.type===type)&&(category==="all"||t.category===category)&&(!month||monthKey(t.date)===month));
}
function renderTransactionTable(){
  const list=filteredTransactions();$("transactionCount").textContent=`${list.length} record${list.length===1?"":"s"}`;
  $("transactionRows").innerHTML=list.map(t=>`<tr><td><div class="table-description"><span class="transaction-symbol ${t.type}">${escapeHtml(symbolFor(t.category))}</span><div><b>${escapeHtml(t.title)}</b>${t.note?`<small>${escapeHtml(t.note)}</small>`:""}</div></div></td><td><span class="category-pill">${escapeHtml(t.category)}</span></td><td>${escapeHtml(fmtDate(t.date))}</td><td><span class="type-pill ${t.type}">${t.type==="income"?"Income":"Expense"}</span></td><td class="amount-cell ${t.type==="income"?"positive":"negative"}">${t.type==="income"?"+":"−"}${money(t.amount)}</td><td><div class="row-actions"><button class="icon-button" data-edit="${escapeHtml(t.id)}" aria-label="Edit ${escapeHtml(t.title)}">Edit</button><button class="icon-button" data-delete="${escapeHtml(t.id)}" aria-label="Delete ${escapeHtml(t.title)}">×</button></div></td></tr>`).join("");
  $("emptyTransactions").classList.toggle("show",list.length===0);
  $("transactionRows").closest(".table-wrap").classList.toggle("hidden",list.length===0);
}
function renderAnalytics(){
  const month=$("analyticsMonth").value||currentMonth(),items=monthTransactions(month),t=monthTotals(month);
  $("analyticsIncome").textContent=money(t.income);$("analyticsExpense").textContent=money(t.expense);
  $("analyticsRate").textContent=t.income?`${Math.round((t.income-t.expense)/t.income*100)}%`:"—";
  $("analyticsCount").textContent=String(t.count);
  const cats=categoryTotals(items),sum=t.expense,max=cats[0]?.[1]||1;
  $("expenseBreakdown").innerHTML=cats.length?cats.map(([name,amount],i)=>`<div class="breakdown-row"><span class="breakdown-label">${escapeHtml(name)}</span><span class="breakdown-amount">${money(amount)} · ${sum?Math.round(amount/sum*100):0}%</span><div class="category-track"><span style="width:${amount/max*100}%;background:${COLORS[i%COLORS.length]}"></span></div></div>`).join(""):'<p class="no-data">No expense data for this month yet.</p>';
  const insights=[];
  if(t.income===0&&t.expense===0)insights.push(["◌","Ready when you are","Add income and expenses to see useful insights here."]);
  if(t.income>0){const rate=(t.income-t.expense)/t.income*100;insights.push([rate>=20?"↗":"◎","Savings rate",`You saved ${Math.round(rate)}% of recorded income this month.`]);}
  if(cats.length)insights.push(["◆","Largest expense",`${cats[0][0]} accounts for ${sum?Math.round(cats[0][1]/sum*100):0}% of your expenses.`]);
  if(data.budget>0){const p=t.expense/data.budget*100;insights.push([p>100?"!":"✓","Budget check",p>100?`You are ${money(t.expense-data.budget)} over your monthly budget.`:`You have ${money(data.budget-t.expense)} left in your monthly budget.`]);}
  $("insights").innerHTML=insights.map(([icon,title,body])=>`<div class="insight"><span class="insight-icon">${escapeHtml(icon)}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(body)}</p></div></div>`).join("");
}
function renderPlanning(month,totals){
  const b=data.budget,p=b?totals.expense/b*100:0;
  $("planningBudget").textContent=b?money(b):"Not set";
  $("planningBudgetText").textContent=b?`${money(totals.expense)} spent in ${monthLabel(month)} · ${p>100?`${money(totals.expense-b)} over budget`:`${money(b-totals.expense)} remaining`}`:"Set a monthly budget to track your spending.";
  $("planningBudgetProgress").style.width=`${Math.min(100,p)}%`;$("planningBudgetProgress").classList.toggle("over",p>100);
  const g=data.goal,goalPct=g.target?Math.min(100,g.saved/g.target*100):0;
  $("goalName").textContent=g.name||"My savings goal";$("goalSaved").textContent=money(g.saved);$("goalTargetText").textContent=`Target: ${money(g.target)}`;
  $("goalProgress").style.width=`${goalPct}%`;$("goalPercent").textContent=g.target?`${Math.round(goalPct)}% complete · ${money(Math.max(0,g.target-g.saved))} to go`:"Set a target to start tracking progress.";
}
function refreshCategoryFilters(){
  const selected=$("categoryFilter").value;
  const categories=[...new Set([...CATEGORIES.expense,...CATEGORIES.income,...data.transactions.map(t=>t.category)])].sort();
  $("categoryFilter").innerHTML='<option value="all">All categories</option>'+categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if(categories.includes(selected))$("categoryFilter").value=selected;
}
function populateCategories(type,selected){
  const list=[...new Set([...CATEGORIES[type],...data.transactions.filter(t=>t.type===type).map(t=>t.category)])];
  $("transactionCategory").innerHTML=list.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if(selected&&list.includes(selected))$("transactionCategory").value=selected;
}
function openTransaction(id){
  $("transactionForm").reset();$("formError").textContent="";
  const t=id?data.transactions.find(x=>x.id===id):null;
  $("transactionId").value=t?t.id:"";$("transactionDialogTitle").textContent=t?"Edit transaction":"Add transaction";
  $("transactionTitle").value=t?.title||"";$("transactionAmount").value=t?.amount??"";
  $("transactionType").value=t?.type||"expense";$("transactionDate").value=t?.date||dateString();$("transactionNote").value=t?.note||"";
  populateCategories($("transactionType").value,t?.category);
  $("transactionDialog").showModal();setTimeout(()=>$("transactionTitle").focus(),50);
}
function openBudget(){ $("budgetAmount").value=data.budget||"";$("budgetDialog").showModal(); }
function openGoal(){ $("goalNameInput").value=data.goal.name;$("goalTargetInput").value=data.goal.target||"";$("goalSavedInput").value=data.goal.saved||0;$("goalDialog").showModal(); }
function downloadFile(name,content,type){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportJson(){
  const backup={...data,app:"RupeeFlow",schemaVersion:2,exportedAt:new Date().toISOString()};
  downloadFile(`rupeeflow-backup-${dateString()}.json`,JSON.stringify(backup,null,2),"application/json");
  notify("JSON backup downloaded.");
}
function csvCell(value){const text=String(value??"");return `"${text.replace(/"/g,'""')}"`}
function exportCsv(){
  const list=filteredTransactions();
  if(!list.length){notify("There are no matching transactions to export.",true);return;}
  const rows=[["Date","Description","Type","Category","Amount (INR)","Note"],...list.map(t=>[t.date,t.title,t.type,t.category,t.amount,t.note||""])];
  const csv="\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
  downloadFile(`rupeeflow-transactions-${dateString()}.csv`,csv,"text/csv;charset=utf-8");
  notify(`${list.length} transaction${list.length===1?"":"s"} exported to CSV.`);
}
async function importJson(file){
  if(!file)return;
  try{
    const raw=JSON.parse(await file.text());
    if(!raw||typeof raw!=="object"||!Array.isArray(raw.transactions))throw new Error("This file does not look like a RupeeFlow backup.");
    if(!confirm(`Import ${raw.transactions.length} transaction(s)? This replaces the current RupeeFlow data.`))return;
    data=normalizeData(raw);
    if(saveData()){refreshCategoryFilters();render();notify("Backup restored successfully.");}
  }catch(error){notify(error.message||"Could not read that backup file.",true);}
  finally{$("importJson").value="";}
}
function closeDialog(id){$(id).close()}
function setupNavigation(){
  document.querySelectorAll(".nav-link").forEach(link=>link.addEventListener("click",()=>{
    document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a===link));
    $("pageTitle").textContent=link.textContent.trim().replace(/^[◫⇄▥◎]\s*/,"");
  }));
  const sections=[...document.querySelectorAll(".section")];
  if("IntersectionObserver"in window){
    const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;const link=document.querySelector(`.nav-link[href="#${visible.target.id}"]`);if(link){document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a===link));$("pageTitle").textContent=link.textContent.trim().replace(/^[◫⇄▥◎]\s*/,"");}},{rootMargin:"-15% 0px -65% 0px",threshold:[0,.2,.5]});
    sections.forEach(section=>observer.observe(section));
  }
}
function bindEvents(){
  ["addTop","addTransaction","emptyAdd"].forEach(id=>$(id).addEventListener("click",()=>openTransaction()));
  $("budgetQuick").addEventListener("click",openBudget);$("budgetEdit").addEventListener("click",openBudget);$("goalEdit").addEventListener("click",openGoal);
  $("exportJson").addEventListener("click",exportJson);$("exportJsonSide").addEventListener("click",exportJson);
  $("exportCsv").addEventListener("click",exportCsv);$("exportCsvPlan").addEventListener("click",exportCsv);
  $("importJson").addEventListener("change",event=>importJson(event.target.files?.[0]));
  $("monthPicker").value=currentMonth();$("analyticsMonth").value=currentMonth();
  $("monthPicker").addEventListener("change",render);$("analyticsMonth").addEventListener("change",renderAnalytics);
  ["searchInput","typeFilter","categoryFilter","dateFilter"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",renderTransactionTable));
  $("clearFilters").addEventListener("click",()=>{$("searchInput").value="";$("typeFilter").value="all";$("categoryFilter").value="all";$("dateFilter").value="";renderTransactionTable();});
  $("transactionType").addEventListener("change",()=>populateCategories($("transactionType").value));
  $("transactionForm").addEventListener("submit",event=>{
    event.preventDefault();const id=$("transactionId").value,title=$("transactionTitle").value.trim(),amount=Number($("transactionAmount").value),date=$("transactionDate").value,type=$("transactionType").value,category=$("transactionCategory").value,note=$("transactionNote").value.trim();
    if(!title||!Number.isFinite(amount)||amount<=0||!date){$("formError").textContent="Enter a description, a valid amount, and a date.";return;}
    const existing=id?data.transactions.find(t=>t.id===id):null;
    const item={id:id||uid(),title,amount,date,type,category,note,createdAt:existing?.createdAt||new Date().toISOString()};
    if(existing)Object.assign(existing,item);else data.transactions.push(item);
    if(saveData()){closeDialog("transactionDialog");refreshCategoryFilters();render();notify(existing?"Transaction updated.":"Transaction added.");}
  });
  $("budgetForm").addEventListener("submit",event=>{
    event.preventDefault();const value=Number($("budgetAmount").value);
    if(!Number.isFinite(value)||value<0){notify("Enter a valid budget amount.",true);return;}
    data.budget=value;if(saveData()){closeDialog("budgetDialog");render();notify(value?"Monthly budget saved.":"Monthly budget removed.");}
  });
  $("goalForm").addEventListener("submit",event=>{
    event.preventDefault();const name=$("goalNameInput").value.trim(),target=Number($("goalTargetInput").value),saved=Number($("goalSavedInput").value);
    if(!name||!Number.isFinite(target)||target<0||!Number.isFinite(saved)||saved<0){notify("Enter a valid goal name and amounts.",true);return;}
    data.goal={name,target,saved};if(saveData()){closeDialog("goalDialog");render();notify("Savings goal updated.");}
  });
  $("transactionRows").addEventListener("click",event=>{
    const edit=event.target.closest("[data-edit]"),del=event.target.closest("[data-delete]");
    if(edit)openTransaction(edit.dataset.edit);
    if(del){const t=data.transactions.find(x=>x.id===del.dataset.delete);if(t&&confirm(`Delete "${t.title}"? This cannot be undone.`)){data.transactions=data.transactions.filter(x=>x.id!==t.id);if(saveData()){refreshCategoryFilters();render();notify("Transaction deleted.");}}}
  });
  document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>closeDialog(button.dataset.close)));
  document.querySelectorAll("dialog").forEach(dialog=>dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();}));
}
function init(){
  refreshCategoryFilters();bindEvents();setupNavigation();render();
  if("serviceWorker"in navigator&&/^https?:$/.test(location.protocol)){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(error=>console.warn("Offline support registration failed:",error)));
  }
}
init();
