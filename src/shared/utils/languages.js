

export const getTtl = (txt, ln) => {
    // Handle both 'English'/'en' and 'Russian'/'ru' formats
    let num = (ln === 'English' || ln === 'en') ? 0 : 1
    return TitlesArr.find(obj => txt in obj)?.[txt][num]
}



const TitlesArr = [
    { 'Assistant': ['Assistant', 'Ассистент'] },
    { 'Hello! How can I assist you today?': ['Hello! How can I assist you today?', 'Здравствуйте! Чем могу помочь?'] },
    { 'I am your assistant. This is a demo chatbot UI. (No backend connected)': ['I am your assistant. This is a demo chatbot UI. (No backend connected)', 'Я ваш ассистент. Это демонстрационный чат-бот (без подключения к серверу)'] },
    { Logout: ['Logout', 'Выйти'] },
    { Confirm: ['Confirm', 'Подтвердить'] },
    { Cancel: ['Cancel', 'Отменить'] },

    //***SideBar */
    { 'MAIN MENU': ['MAIN MENU', 'ГЛАВНОЕ МЕНЮ'] },
    { Apps: ['Apps', 'Приложения'] },
    { Message: ['Message', 'Сообщение'] },
    { Call: ['Call', 'Звонок'] },
    { Calendar: ['Calendar', 'Календарь'] },
    { Miscellaneous: ['Miscellaneous', 'Разное'] },
    { Shipments: ['Shipments', 'Отгрузки'] },
    { Review: ['Review', 'Обзор'] },
    { 'IMS Summary': ['IMS Summary', 'IMS Обзор'] },
    { Statements: ['Statements', 'Заявления'] },
    { Dashboard: ['Dashboard', 'Панель приборов'] },
    { Contracts: ['Contracts', 'Контракты'] },
    { Invoices: ['Invoices', 'Счета'] },
    { Expenses: ['Expenses', 'Затраты'] },
    { 'Contracts Review': ['Contracts Review', 'Обзор контрактов'] },
    { 'Contracts Review & Statement': ['Contracts Review & Statement', 'Обзор и отчёт контрактов'] },
    { 'Invoices Review': ['Invoices Review', 'Обзор счетов'] },
    { 'Invoices Review & Statement': ['Invoices Review & Statement', 'Обзор и отчёт счетов'] },
    { 'Inventory Review': ['Inventory Review', 'Обзор запасов'] },
    { 'Contracts Statement': ['Contracts Statement', 'Отчёт о контрактах'] },
    { 'Invoices Statement': ['Invoices Statement', 'Отчет о счетах'] },
    { Stocks: ['Stocks', 'Склады'] },
    { Settings: ['Settings', 'Настройки'] },
    { Accounting: ['Accounting', 'Бухгалтерский учет'] },
    { 'Account Statement': ['Account Statement', 'Выписка по счету'] },

    /*****Settings */
    { 'Company Details': ['Company Details', 'Pеквизиты компании'] },
    { Setup: ['Setup', 'Настройка'] },
    { Suppliers: ['Suppliers', 'Поставщики'] },
    { Clients: ['Clients', 'Клиенты'] },
    { 'Bank Account': ['Bank Account', 'Банковский счет'] },
    { Add: ['Add', 'Добавить'] },
    { Update: ['Update', 'Oбновить '] },
    { Delete: ['Delete', 'Удалить'] },
    { Clear: ['Clear', 'Oчистить'] },

    { Name: ['Name', 'Имя'] },
    { 'Nick Name': ['Nick Name', 'Прозвище'] },
    { Other: ['Other', 'Дополнительное'] },
    { email: ['Email', 'Адрес электронной почты'] },
    { Fax: ['Fax', 'Факс'] },
    { Bank: ['Bank', 'Банк'] },
    { BankNickName: ['Back Nick Name', 'Прозвище Банкa'] },
    { Note: ['Note', 'Примечание'] },
    { Currency: ["USD/EUR", 'Валюта'] },
    { Address: ['Address', 'Адрес'] },


    { cmpName: ['Company Name', 'Название компании'] },
    { lng: ['Language', 'Язык'] },
    { street: ['Street', 'Улица'] },
    { city: ['City', 'Город'] },
    { country: ['Country', 'Страна'] },
    { zipCode: ['Zip Code', 'Почтовый индекс'] },
    { cmpemail: ['Email Address', 'Адрес электронной почты'] },
    { cmpwebsite: ['Website', 'Веб-сайт'] },
    { cmpPhone: ['Phone', 'Телефон'] },
    { cmpMobile: ['Mobile', 'Mобильный'] },

    { save: ['Save', 'Cохранить'] },
    { saving: ['Saving', 'Cохраняет'] },

    ///*****Modals */
    { delConfirmation: ['Delete Confirmation', 'Подтвердить удаление'] },
    {
        delConfirmationTxtStock: ['Deleting this stock is irreversible. Please confirm to proceed.',
            'Удаление этой акции является необратимым. Пожалуйста, подтвердите, чтобы продолжить.']
    },
    {
        delConfirmationTxtSup: ['Deleting this supplier is irreversible. Please confirm to proceed.',
            'Удаление этого поставщика является необратимым. Пожалуйста, подтвердите, чтобы продолжить.']
    },
    {
        delConfirmationTxtClient: ['Deleting this client is irreversible. Please confirm to proceed.',
            'Удаление этого клиента является необратимым. Пожалуйста, подтвердите, чтобы продолжить.']
    },
    {
        delConfirmationTxtBank: ['Deleting this account is irreversible. Please confirm to proceed.',
            'Удаление этого банковского счета является необратимым. Пожалуйста, подтвердите, чтобы продолжить.']
    },

    ///****Table */
    { Columns: ['Columns', 'Столбцы'] },
    { Excel: ['Excel', 'Эксель'] },
    { Search: ['Search', 'Поиск'] },
    { Showing: ['Showing', 'Показаны'] },
    { 'Rows per page': ['Rows per page', 'Строк на странице'] },


    /******Contracts */
    { 'Operation Time': ['Operation Time', 'Время операции'] },
    { PO: ['PO', 'Заказ'] },
    { Date: ['Date', 'Дата'] },
    { 'Last Saved': ['Last Saved', 'Последнее сохранение'] },
    { Supplier: ['Supplier', 'Поставщик'] },
    { Shipment: ['Shipment', 'Oтправка'] },
    { Origin: ['Origin', 'Происхождение'] },
    { 'Delivery Terms': ['Delivery Terms', 'Условия поставки'] },
    { POL: ['POL', 'Порт погрузки'] },
    { POD: ['POD', 'Порт назначения'] },
    { Packing: ['Packing', 'Упаковка'] },
    { 'Container Type': ['Container Type', 'Тип контейнера'] },
    { Size: ['Size', 'Размер'] },
    { 'Delivery Time': ['Delivery Time', 'Срок поставки'] },
    { Quantity: ['Quantity', 'Вес'] },
    { QTY: ['QTY', 'Вес'] },
    { 'New Contract': ['New Contract', 'Новый контракт'] },
    { 'Contract No': ['Contract No', 'Номер контракта'] },

    { Contract: ['Contract', 'Контракт'] },
    { Invoices: ['Invoices', 'Счета'] },
    { 'Shipments Tracking': ['Shipments Tracking', 'Отгрузки'] },
    { Inventory: ['Inventory', 'Инвентарь'] },

    { 'Supplier Name': ['Supplier Name', 'Имя поставщика'] },
    { 'Payment Terms': ['Payment Terms', 'Условия оплаты'] },
     { 'Payment Date': ['Payment Date', 'Дата оплаты'] },
    { 'PoOrderNo': ['Purchase Order No', 'Заказ Nº'] },
    { 'Attachments': ['Attachments', 'Вложения'] },
    { 'Comments': ['Comments', 'Комментарии'] },

    { 'Close': ['Close', 'Закрыть'] },
    { 'Delete Contract': ['Delete Contract', 'Удалить контракт'] },
    { 'Duplicate Contract': ['Duplicate Contract', 'Дубликат контракта'] },

    {
        delConfirmationTxtContract: ['Deleting this contract is irreversible. Please confirm to proceed.',
            'Удаление этого контракта является необратимым. Пожалуйста, подтвердите, чтобы продолжить.']
    },
    {
        duplicateConfirmationTxt: ['To duplicate the existed contract please confirm to proceed.',
            'Чтобы дублировать существующий контракт, подтвердите действие.']
    },

    { 'Remarks': ['Remarks', 'Комментарии'] },
    { 'AddRemark': ['Add remark', 'Добавить замечание'] },
    { 'AddFormula': ['Add Formula', 'Добавить формулу'] },
    { 'PriceFormula': ['Price Formula', 'Формула цены'] },

    { 'AddProduct': ['Add product', 'Добавить материал'] },
    { 'DelProduct': ['Delete product', 'Удалить материал'] },
    { 'POInvoices': ['Purchase Invoices', 'Счета за покупку'] },
    { 'warehouse': ['Material warehouse', 'Склад материалов'] },

    { 'Description': ['Description', 'Материал'] },
    { 'UnitPrice': ['Unit Price', 'Цена единицы'] },
    { 'PurchaseInv': ['Purchase Inv', 'Покупка Счет'] },
    { 'InvoiceValue': ['Invoice Value', 'Стоимость счета'] },
    { 'Payment': ['Payment', 'Оплата'] },
    { 'Prepayment': ['Prepayment', 'Предоплата'] },
    { 'Balance': ['Balance', 'Баланс'] },
    { 'Materials Breakdown': ['Materials Breakdown', 'Разбивка материалов'] },
    { 'Price': ['Price', 'Цена'] },
    { 'Total': ['Total', 'Сумма'] },
    { 'Arrival Date': ['Arrival Date', 'Дата прибытия'] },
    { Stock: ['Stock', 'Склад'] },

    { 'Contract files': ['Contract files', 'Файлы контрактов'] },


    /*****Invoice */
    { Consignee: ['Consignee', 'Грузополучатель'] },
    { 'Invoice Type': ['Invoice Type', 'Тип счета'] },
    { 'Invoice': ['Invoice', 'Счет'] },
    { 'Credit Note': ['Credit Note', 'Кредитная нота'] },
    { 'Final Note': ['Final Note', 'Заключительная нота'] },
    { 'selectOriginalInvoice': ['Please select original invoice', 'Пожалуйста, выберите оригинальный счет'] },
    { 'Status': ['Status', 'Статус'] },
    { 'Delivery Date': ['Delivery Date', 'Дата доставки'] },
    { 'Delete Invoice': ['Delete Invoice', 'Удалить счет'] },
    { 'Payments': ['Payments', 'Платежи'] },
    { 'Copy Invoice': ['Copy Invoice', 'Копировать счет'] },
    {
        delConfirmationTxtInvoice: ['Deleting this invoice is irreversible. Please confirm to proceed.',
            'Удаление этого счета является необратимым. Пожалуйста, подтвердите, чтобы продолжить.']
    },
    { 'Expense Invoice': ['Expense Invoice', 'Счет расхода'] },
    { 'Amount': ['Amount', 'Сумма'] },
    { Vendor: ['Vendor', 'Поставщик'] },
    { 'Expense Type': ['Expense Type', 'Тип расхода'] },
    { 'New': ['New', 'Oчистить'] },
    { 'Actual Payment': ['Actual Payment', 'Платеж'] },

    { copyInvoice: ['Please select the requested contract!', 'Пожалуйста, выберите запрошенный контракт!'] },
    {
        copyInvoiceTxt: ['To paste the invoice, navigate to the "Invoices" tab and click the "Paste" button.',
            'Чтобы вставить счет, перейдите на вкладку "Счета" и нажмите кнопку "Вставить"']
    },
    { 'Paste invoice': ['Paste invoice', 'Вставить'] },
    { 'Container No': ['Container No', 'Контейнер #'] },
    { 'Truck No': ['Truck No', 'Номер грузовика'] },
    { 'Flight No': ['Flight No', 'Номер рейса'] },
    { 'Container pls': ['Container pls', 'Контейнер pls'] },
    { 'Available Quantity': ['Available Quantity', 'Доступное количество'] },
    { 'Total Amount': ['Total Amount', 'Общая сумма'] },
    { 'Prepaid Amount': ['Prepaid Amount', 'Сумма предоплаты'] },
    { 'Balance Due': ['Balance Due', 'Баланс за счет'] },
    { 'Edit Description': ['Edit Description', 'Изменить описание'] },
    { 'Original Description': ['Original Description', 'Исходное описание'] },

    { 'mustFilled': ['Field must be filled', 'Поле должно быть заполнено'] },
    { 'totalNet': ['Total Net WT Kgs', 'Общий вес нетто, кг'] },
    { 'totalTare': ['Total Tarre WT Kgs', 'Общий вес тары, кг'] },
    { 'totalGross': ['Total Gross WT Kgs', 'Общий вес брутто, кг'] },
    { 'totalPack': ['Total Packages', 'Коли́чество пакетов'] },


    { 'selectCurr': ['Select Currency', 'Выберите валюту'] },
    { 'purchaseValue': ['Purchase Value', 'Стоимость покупки'] },
    { 'invValueSale': ['Inv Value Sales', 'Инв стоимость продаж'] },
    { 'Profit': ['Profit', 'Прибыль'] },
    { 'SalesInvoices': ['Sales Invoices', 'Счета за продажу'] },
    { 'Invoices summary': ['Invoices summary', 'Сводка счетов'] },
    { Deviation: ['Deviation', 'Отклонение'] },
    { Prepaid: ['Prepaid', 'Предоплача'] },
    { 'Initial Debt': ['Initial Debt', 'Первоначальный долг'] },
    { 'debtAfterPrepPmnt': ['Debt After Prepayment', 'Долг после предоплаты'] },
    { 'Debt Balance': ['Debt Balance', 'Остаток долга'] },

    { 'Hide Details': ['Hide Details', 'Скрыть детали'] },
    { 'Show Details': ['Show Details', 'Показать детали'] },

    { 'Finalizing': ['Finalizing', 'Завершение'] },
    { 'Release Status': ['Release Status', 'Статус выпуска'] },

    { 'Purchase QTY': ['Purchase QTY', 'Вес покупки'] },
    { 'Remaining QTY': ['Remaining QTY', 'Оставшееся количество'] },
    { 'Shipped Net': ['Shipped Net', 'Отправлено нетто'] },

    /*****Expenses */
    { 'Existing Expense': ['Existing Expense', 'Существующии расход'] },
    { 'Paid / Unpaid': ['Paid / Unpaid', 'Платный/Неоплачиваемый'] },
    { 'Paid': ['Paid', 'Оплаченный'] },
    { 'UnPaid': ['UnPaid', 'Неоплачиваемый'] },


    /****Invoices Review */
    { 'Supplier inv': ['Supplier inv', 'Инв поставщика'] },
    { 'Sup Inv amount': ['Sup Inv amount', 'Сумма заказа'] },
    { 'Sup Prepayment': ['Sup Prepayment', 'Предоплата поставщика'] },
    { 'Credit/Final Note': ['Credit/Final Note', 'Кредитная/Заключительная нота'] },
    { 'Shipped Weight': ['Shipped Weight', 'Отгруженный вес'] },
    { 'Remaining Weight': ['Remaining Weight', 'Оставшийся вес'] },
    { 'PO Client': ['PO Client', 'Заказ клиента'] },
    { Destination: ['Destination', 'Место назначения'] },
    { 'Comments/Status': ['Comments/Status', 'Комментарии/Статус'] },
    { 'Invoices amount': ['Invoices amount', 'Сумма счета'] },
    { Weight: ['Weight', 'Вес'] },

    { 'Less than 0 MT': ['Less than 0 MT', 'Менее 0 MT'] },
    { 'Between 0 to 1 MT': ['Between 0 to 1 MT', 'От 0 до 1 MT'] },
    { 'Greater than 1 MT': ['Greater than 1 MT', 'Более 1 MT'] },
    { 'Show all': ['Show all', 'Показать все'] },

    { 'of': ['of', 'из'] },
    { 'Move to new Stock': ['Move to new Stock', 'Перенести на новый склад'] },
    { 'Change Stock': ['Change Stock', 'Изменить склад'] },

    { 'Show Shipments': ['Show Shipments', 'Показать поставки'] },
    { 'Hide Shipments': ['Hide Shipments', 'Скрыть поставки'] },
    { 'Transaction': ['Transaction', 'Движение'] },
    { 'Supplier/Consignee': ['Supplier/Consignee', 'Поставщик/Грузополучатель'] },


    ///************Dashboard */
    { 'Contracts & Expenses': ['Contracts & Expenses', 'Контракты и расходы'] },
    { 'P&L': ['P&L', 'Прибыли и убытки'] },
    { 'Sales': ['Sales', 'Продажи'] },
    { 'Costs': ['Costs', 'Расходы'] },
    { 'Top 5 Consignees - $': ['Top 5 Consignees - $', 'Топ-5 грузополучателей - $'] },
    { 'Top 5 Contracts - $': ['Top 5 Contracts - $', 'Топ-5 контрактов – $'] },

    //****Toast */
    { 'Contract successfully saved!': ['Contract successfully saved!', 'Контракт успешно сохранен!'] },
    { 'Invoice successfully saved!': ['Invoice successfully saved!', 'Счет успешно сохранен!'] },
    {
        'contractCantbeDeleted1': ['This contract contains customer invoices; therefore, it cannot be deleted!',
            'Этот договор содержит счета клиентов; поэтому его нельзя удалить!']
    },
    {
        'contractCantbeDeleted2': ['This contract contains stocks; therefore, it cannot be deleted!',
            'Этот контракт содержит склад; поэтому его нельзя удалить!']
    },
    {
        'contractCantbeDeleted3': ['This contract contains vendor invoices; therefore, it cannot be deleted!',
            'Этот контракт содержит счета поставщиков; следовательно, его нельзя удалить!']
    },
    {
        'Contract successfully deleted!': ['Contract successfully deleted!',
            'Контракт успешно удален!']
    },
    {
        'Some fields are missing!': ['Some fields are missing!',
            'Некоторые поля отсутствуют!']
    },
    {
        'Data successfully saved!': ['Data successfully saved!',
            'Данные успешно сохранены!']
    },
    {
        'Please fill payments table correctly': ['Please fill payments table correctly',
            'Пожалуйста, заполните таблицу платежей правильно']
    },
    {
        'Contract must be saved first!': ['Contract must be saved first!',
            'Контракт необходимо сначала сохранить!']
    },
    {
        'Payments successfully saved!': ['Payments successfully saved!',
            'Платежи успешно сохранены!']
    },
    {
        'Stock successfully saved!': ['Stock successfully saved!',
            'Склад успешно сохранен!']
    },
    {
        'This invoice is relayed to one of contract invoices!': ['This invoice is relayed to one of contract invoices!',
            'Этот счет передается на один из счетов по контракту!']
    },
    {
        'This invoice contains expenses; therefore, it cannot be deleted!': ['This invoice contains expenses; therefore, it cannot be deleted!',
            'Этот счет содержит расходы; поэтому его нельзя удалить!']
    },
    {
        'This invoice contains materials; therefore, it cannot be deleted!': ['This invoice contains materials; therefore, it cannot be deleted!',
            'Этот счет содержит материалы; поэтому его нельзя удалить!']
    },
    {
        'Invoice successfully deleted!': ['Invoice successfully deleted!',
            'Счет успешно удален!']
    },
    {
        'Some fields are still empty!': ['Some fields are still empty!',
            'Некоторые поля еще пусты!']
    },
    {
        'The following fields in the materials table are empty:': ['The following fields in the materials table are empty:',
            'Следующие поля в таблице материалов пусты:']
    },
    {
        'Total Tarre WT Kgs can not be negative!': ['Total Tarre WT Kgs can not be negative!',
            'Общий вес Тарре в кг не может быть отрицательным!']
    },
    {
        'Invoice successfully copied!': ['Invoice successfully copied!',
            'Счет успешно скопирован!']
    },
    {
        'Expense successfully saved!': ['Expense successfully saved!',
            'Расход успешно сохранен!']
    },
    {
        'Expense successfully deleted!': ['Expense successfully deleted!',
            'Расход успешно удален!']
    },
    {
        'Company data successfully saved!': ['Company data successfully saved!',
            'Данные компании успешно сохранены!']
    },
    {
        'Details expanded': ['Details expanded',
            'Подробности расширены']
    },
    {
        'Please enter numbers only!': ['Please enter numbers only!',
            'Пожалуйста, введите только цифры!']
    },
    {
        'NumbersOnlyWith3digits': ['Please enter numbers only with at most three digits after the dot!',
            'Пожалуйста, вводите числа, содержащие не более трех цифр после точки!']
    },
    {
        'TableIsEmpty': ['Contract`s materials table is empty!',
            'Таблица материалов контракта пуста!']
    },

    {
        'WeightType': ['Weight type', 'Тип веса']
    },
    {
        'SummarySuppliers': ['Summary-Suppliers', 'Итоги поставщика']
    },
    {
        'SummaryClients': ['Summary-Clients', 'Итоги клиента']
    },
    {
        'Stock type': ['Stock type', 'Тип Склада']
    },
    {
        'Warehouse type': ['Warehouse type', 'Тип Склада']
    },
    {
        'SummaryStocks': ['Summary-Stocks', 'Итоги Склада']
    },
    {
        'DashbordDatesAlert': ['The start and the end of the selected  period must be within the same year',
            'Начало и конец периода могут приходиться в один и тот же год']
    },
    {
        'Filters': ['Filters', 'Фильтры']
    },
    {
        'Users': ['Users', 'Пользователи']
    },
    {
        'FinalSettlmnt': ['Final Settlement', 'Окончательный расчет']
    },
    {
        'FinalQuantity': ['Final Qty', 'Окончательное количество']
    },

    {
        'Weight Analysis': ['Weight Analysis', 'Анализ веса']
    },
    {
        'DuePayment': ['Due Payment', 'Причитающийся платеж']
    },
    {
        'Margins': ['Margins', 'Прибыль']
    },
    {
        'Cashflow': ['Cashflow', 'Денежный поток']
    },
    {
        'Reset Table': ['Reset Table', 'Сбросить таблицу']
    },
    {
        'Sharon Admin': ['Sharon Admin', 'Sharon Admin']
    },
     {
        'Gis Admin': ['Gis Admin', 'Gis Admin']
    },
    {
        'Miscellaneous': ['Miscellaneous', 'Разнообразный']
    },
    {
        'Misc Invoices': ['Misc Invoices', 'Специальные счета']
    },
    {
        'Company Expenses': ['Company Expenses', 'Расходы компании']
    },
    {
        'Material Tables': ['Material Tables', 'Материал таблицы']
    },
     {
        'Formulas Calc': ['Formulas Calc', 'Формулы']
    },
    
]

