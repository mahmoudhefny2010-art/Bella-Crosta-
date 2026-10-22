export async function openOrderEditor(ctx,order,onSaved) {
  const {api,esc,money,local,language,busy}=ctx;
  const ar=language==='ar',text=(en,arabic)=>esc(ar?arabic:en);
  const {products}=await api('/api/menu');
  const rows=order.items.map(item=>({productId:item.product_id,quantity:item.quantity,optionIds:item.options.map(option=>option.id),custom:Boolean(item.is_custom)}));
  const dialog=document.createElement('dialog');
  dialog.className='order-edit-dialog';dialog.dataset.orderEdit='';dialog.setAttribute('aria-labelledby','order-edit-heading');
  dialog.innerHTML=`<form><header class="order-edit-header"><div><h3 id="order-edit-heading">${text('Edit order','تعديل الطلب')}</h3><p>${text('Changes are available until the kitchen accepts your order. Current menu prices apply.','تقدر تعدل لحد ما المطبخ يقبل الطلب. الأسعار حسب المنيو الحالي.')}</p></div><button type="button" data-close aria-label="${text('Close','إغلاق')}">×</button></header><div data-edit-lines></div><button type="button" data-add-line>${text('Add item','إضافة صنف')} +</button><label>${text('Order notes','ملاحظات الطلب')}<textarea name="notes" maxlength="1000" rows="3">${esc(order.notes || '')}</textarea></label><div class="order-edit-totals" aria-live="polite"></div><p data-edit-error role="alert" hidden></p><footer class="order-edit-actions"><button type="button" data-close>${text('Cancel','إلغاء')}</button><button class="primary" type="submit">${text('Save changes','حفظ التعديلات')}</button></footer></form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form'),lines=dialog.querySelector('[data-edit-lines]'),error=dialog.querySelector('[data-edit-error]');
  const productFor=row=>products.find(product=>product.id===row.productId);
  function draw() {
    let subtotal=0,valid=rows.length>0;
    lines.innerHTML=rows.map((row,index)=>{
      const product=productFor(row);
      if(!product)valid=false;
      const options=product?.options || [];
      const cost=product?Number(product.sale_price_egp??product.price_egp)+options.filter(option=>row.optionIds.includes(option.id)).reduce((sum,option)=>sum+Number(option.price_delta_egp),0):0;
      subtotal+=cost*row.quantity;
      return `<section class="order-edit-line" data-line="${index}"><div class="order-edit-fields"><label>${text('Pizza','البيتزا')}<select data-product>${!product?`<option value="${esc(row.productId)}">${text('Unavailable — choose another item','غير متاح — اختار صنف تاني')}</option>`:''}${products.map(item=>`<option value="${item.id}" ${row.productId===item.id?'selected':''}>${esc(local(item,'name'))}</option>`).join('')}</select></label><label>${text('Quantity','الكمية')}<input data-quantity type="number" min="1" max="20" step="1" value="${row.quantity}" required></label><button type="button" class="danger" data-remove-line>${text('Remove','حذف')}</button></div>${options.some(option=>option.option_group==='sauce')?`<label class="order-edit-choice"><input type="checkbox" data-custom ${row.custom?'checked':''}>${text('Custom pizza','بيتزا مخصصة')}</label>`:''}<div class="order-edit-options">${options.filter(option=>option.option_group!=='sauce'||row.custom).map(option=>`<label class="order-edit-choice"><input type="${option.option_group==='sauce'?'radio':'checkbox'}" name="option-${index}-${option.option_group==='sauce'?'sauce':option.id}" data-option="${option.id}" ${row.optionIds.includes(option.id)?'checked':''}>${esc(local(option,'name'))} ${Number(option.price_delta_egp)?`(+ ${esc(money(option.price_delta_egp))})`:''}</label>`).join('')}</div><strong>${esc(money(cost*row.quantity))}</strong></section>`;
    }).join('');
    dialog.querySelector('.order-edit-totals').innerHTML=`<span>${text('Subtotal','المجموع الفرعي')}: ${esc(money(subtotal))}</span><span>${text('Delivery fee','رسوم التوصيل')}: ${esc(money(order.delivery_fee_egp))}</span><strong>${text('Total','الإجمالي')}: ${esc(money(subtotal+Number(order.delivery_fee_egp)))}</strong>`;
    form.querySelector('[type=submit]').disabled=!valid;
    dialog.querySelector('[data-add-line]').disabled=rows.length>=30||!products.length;
  }
  lines.addEventListener('change',event=>{
    const row=rows[Number(event.target.closest('[data-line]')?.dataset.line)];if(!row)return;
    const input=event.target;
    if(input.hasAttribute('data-product')) {row.productId=input.value;row.optionIds=[];row.custom=false;}
    else if(input.hasAttribute('data-quantity')){if(!input.checkValidity())return;row.quantity=Number(input.value);}
    else if(input.hasAttribute('data-custom')){row.custom=input.checked;row.optionIds=row.optionIds.filter(id=>productFor(row).options.find(option=>option.id===id)?.option_group!=='sauce');if(row.custom){const sauce=productFor(row).options.find(option=>option.option_group==='sauce');if(sauce)row.optionIds.push(sauce.id);}}
    else if(input.dataset.option){const option=productFor(row).options.find(option=>option.id===input.dataset.option);if(option.option_group==='sauce')row.optionIds=row.optionIds.filter(id=>productFor(row).options.find(item=>item.id===id)?.option_group!=='sauce');row.optionIds=row.optionIds.filter(id=>id!==option.id);if(input.checked)row.optionIds.push(option.id);}
    draw();
  });
  dialog.addEventListener('click',event=>{
    if(event.target.closest('[data-close]'))dialog.close();
    if(event.target.closest('[data-add-line]')&&rows.length<30&&products.length){rows.push({productId:products[0].id,quantity:1,optionIds:[],custom:false});draw();}
    const remove=event.target.closest('[data-remove-line]');if(remove){rows.splice(Number(remove.closest('[data-line]').dataset.line),1);draw();}
  });
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  form.addEventListener('submit',async event=>{
    event.preventDefault();error.hidden=true;
    try {await busy(form.querySelector('[type=submit]'),async()=>{
      await api('/api/orders/'+order.id,{method:'PATCH',body:{revision:order.edit_revision,notes:form.elements.notes.value,items:rows}});
      dialog.close();await onSaved();
    });}catch(failure){error.textContent=failure.message;error.hidden=false;}
  });
  draw();dialog.showModal();
}
