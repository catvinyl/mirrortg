let tasks = [];

function getTasks() {
  return tasks;
}

function createTask(func, args, delay, timeout) {
  const task = {
    running: false,
    function: func,
    arguments: args,
    delay: delay,
    timeout: timeout
  };
  tasks.push(task);
  return task;
}

function runTasks() {
  tasks.forEach((task) => {
    if (!task.running) {
      task.running = true;
      setTimeout(() => {
        task.function(...Object.values(task.arguments));
        task.running = false;
      }, task.delay);      
    }
  });
}

function runTask(task){
  const promise = new Promise((resolve) => {
    task.timeoutTimerId = setTimeout(() => {
      // console.log(task);
      removeTask(task);
      resolve();
      // console.log(`Task timed out after ${task.timeout}ms`);
    }, task.timeout);     

    task.timeoutId = setTimeout(() => {
      task.running = true;
      task.function(...task.arguments).then(() => {
        
      }).catch((error) => {
        console.error(error);
      }).finally(() => {
        // console.log('TASK DONE');
        task.running = false;
        // console.log('finally');
        removeTask(task);
        resolve();
      });
    }, task.delay);
    
  });
  return promise;
}

function runTasksAsync() {
  var promises = [];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    promises.push(runTask(task));
  }
  return Promise.all(promises);
}

function removeTask(task) {
  if(task.timeoutId){
    clearTimeout(task.timeoutId);
    delete task.timeoutId;
  }
  if(task.timeoutTimerId){
    clearTimeout(task.timeoutTimerId);
    delete task.timeoutTimerId;
  }
  const i = tasks.indexOf(task);
  delete task;
  if (i !== -1) {
    tasks.splice(i, 1);
  }
}

// Example usage:
function test(){
  const task1 = createTask(
    (name, age) => console.log(`Hello, ${name}! You are ${age} years old.`),
    { name: 'John', age: 30 },
    2000,
    60
  );
  
  const task2 = createTask(
    async (message) => console.log(`Received message: ${message}`),
    { message: 'Hello from task 2!' },
    5000,
    60
  );
  
  // runTasks();
  runTasksAsync().then(() => {
    console.log("All tasks completed!");
  }).catch((error) => {
    console.error("Error running tasks:", error);
  });
  // Output:
  // (after 2 seconds) Hello, John! You are 30 years old.
  // (after 5 seconds) Received message: Hello from task 2!
}


exports.createTask = createTask;
exports.runTasks = runTasks;
exports.runTasksAsync = runTasksAsync;

// test();